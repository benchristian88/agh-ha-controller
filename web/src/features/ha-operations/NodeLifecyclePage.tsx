import { useCallback, useEffect, useState } from "react";
import { Banner, ErrorState, Loading } from "../../components/Feedback";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import type {
  Cluster,
  LifecycleSettings,
  MaintenancePreflight,
  Node,
  NodeLifecycle,
  UpgradeOperation,
} from "../../lib/types";

export function NodeLifecyclePage({
  cluster,
  nodeId,
}: {
  cluster: Cluster;
  nodeId: string;
}) {
  const [node, setNode] = useState<Node>();
  const [lifecycle, setLifecycle] = useState<NodeLifecycle>();
  const [preflight, setPreflight] = useState<MaintenancePreflight>();
  const [settings, setSettings] = useState<LifecycleSettings>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState("");
  const [targetVersion, setTargetVersion] = useState("");
  const [upgrades, setUpgrades] = useState<UpgradeOperation[]>([]);
  const load = useCallback(async () => {
    try {
      const [nodes, value, check, upgradeResult] = await Promise.all([
        api.nodes(cluster.id),
        api.nodeLifecycle(nodeId),
        api.maintenancePreflight(nodeId),
        api.upgrades(cluster.id),
      ]);
      setNode(nodes.items.find((item) => item.id === nodeId));
      setLifecycle(value);
      setSettings(value.settings);
      setPreflight(check);
      setUpgrades(upgradeResult.items.filter((item) => item.nodeId === nodeId));
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, [cluster.id, nodeId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (
    (node === undefined ||
      lifecycle === undefined ||
      settings === undefined ||
      preflight === undefined) &&
    error === undefined
  )
    return <Loading label="Loading node lifecycle…" />;
  if (
    node === undefined ||
    lifecycle === undefined ||
    settings === undefined ||
    preflight === undefined
  )
    return <ErrorState error={error} retry={() => void load()} />;
  return (
    <>
      <nav aria-label="Breadcrumb">
        <a href="/ha/nodes">Nodes</a> / {node.name}
      </nav>
      <header className="page-header">
        <div>
          <p className="eyebrow">Node lifecycle</p>
          <h1>{node.name}</h1>
          <p>
            Health, DNS service, certificates, maintenance, software, and
            history.
          </p>
        </div>
        <StatusBadge
          status={node.maintenanceMode ? "maintenance" : node.healthStatus}
        />
      </header>
      {error !== undefined && (
        <Banner tone="warning" title="Operation failed">
          {error instanceof Error
            ? error.message
            : "The operation could not be completed."}
        </Banner>
      )}
      <section className="metrics" aria-label="Node lifecycle status">
        <Metric label="API" value={node.healthStatus} />
        <Metric label="DNS" value={lifecycle.dns?.status ?? "unknown"} />
        <Metric label="Configuration" value={node.convergenceStatus} />
        <Metric label="Version" value={node.version ?? "unknown"} />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>DNS Service</h2>
          <button
            className="button button--secondary"
            type="button"
            disabled={busy !== ""}
            onClick={() => void probe()}
          >
            Probe now
          </button>
        </div>
        <p>
          Active DNS is independent from the authenticated AdGuard API check.
        </p>
        {lifecycle.dns ? (
          <dl className="detail-list">
            <div>
              <dt>State</dt>
              <dd>
                <StatusBadge status={lifecycle.dns.status} />
              </dd>
            </div>
            <div>
              <dt>UDP / TCP</dt>
              <dd>
                {lifecycle.dns.udpStatus} / {lifecycle.dns.tcpStatus}
              </dd>
            </div>
            <div>
              <dt>Response / latency</dt>
              <dd>
                RCODE {lifecycle.dns.responseCode ?? "—"} ·{" "}
                {lifecycle.dns.latencyMs ?? "—"} ms
              </dd>
            </div>
            <div>
              <dt>Last probe</dt>
              <dd>{formatTime(lifecycle.dns.probedAt)}</dd>
            </div>
          </dl>
        ) : (
          <p>No durable DNS measurement yet.</p>
        )}
        <form className="card" onSubmit={(event) => void saveSettings(event)}>
          <h3>Probe and installation settings</h3>
          <label>
            Probe host
            <input
              value={settings.dnsProbeHost}
              placeholder="Defaults to node URL host"
              onChange={(event) =>
                setSettings({ ...settings, dnsProbeHost: event.target.value })
              }
            />
          </label>
          <label>
            Port
            <input
              type="number"
              value={settings.dnsProbePort}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  dnsProbePort: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            Test name
            <input
              value={settings.dnsProbeName}
              onChange={(event) =>
                setSettings({ ...settings, dnsProbeName: event.target.value })
              }
            />
          </label>
          <label>
            Installation type
            <select
              value={settings.installationType}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  installationType: event.target
                    .value as LifecycleSettings["installationType"],
                })
              }
            >
              <option value="unknown">Unknown</option>
              <option value="native_systemd">Native / systemd</option>
              <option value="docker">Docker</option>
              <option value="home_assistant_addon">
                Home Assistant add-on
              </option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.probeUdp}
              onChange={(event) =>
                setSettings({ ...settings, probeUdp: event.target.checked })
              }
            />{" "}
            Verify UDP
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.probeTcp}
              onChange={(event) =>
                setSettings({ ...settings, probeTcp: event.target.checked })
              }
            />{" "}
            Verify TCP
          </label>
          <button className="button" type="submit" disabled={busy !== ""}>
            Save lifecycle settings
          </button>
        </form>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Planned Maintenance</h2>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Healthy DNS nodes remaining</dt>
            <dd>{preflight.healthyDnsNodesRemaining}</dd>
          </div>
          <div>
            <dt>Expected redundancy</dt>
            <dd>{preflight.expectedRedundancy}</dd>
          </div>
          <div>
            <dt>Active deployment</dt>
            <dd>{preflight.activeDeployment ? "Blocking" : "None"}</dd>
          </div>
          <div>
            <dt>Open drift</dt>
            <dd>{preflight.openDrift ? "Warning" : "None"}</dd>
          </div>
          <div>
            <dt>Active DHCP</dt>
            <dd>{preflight.activeDhcp ? "Handoff required" : "No"}</dd>
          </div>
        </dl>
        <ul>
          {preflight.checks.map((check) => (
            <li key={check.name}>
              <strong>{check.name.replaceAll("_", " ")}</strong>: {check.status}{" "}
              — {check.message}
            </li>
          ))}
        </ul>
        {node.maintenanceMode ? (
          <button
            className="button"
            type="button"
            disabled={busy !== ""}
            onClick={() => void returnToService()}
          >
            Validate and return to service
          </button>
        ) : (
          <button
            className="button button--danger"
            type="button"
            disabled={busy !== "" || !preflight.allowed}
            onClick={() => void enterMaintenance()}
          >
            Enter maintenance
          </button>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>TLS / Certificates</h2>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Subject</dt>
            <dd>{lifecycle.certificate.subject || "Not reported"}</dd>
          </div>
          <div>
            <dt>Expiry</dt>
            <dd>{formatTime(lifecycle.certificate.notAfter)}</dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd>
              {lifecycle.certificate.daysRemaining === undefined
                ? "—"
                : `${lifecycle.certificate.daysRemaining} days`}
            </dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{lifecycle.certificate.state}</dd>
          </div>
        </dl>
        <p className="muted">
          Certificate chain, keys, and filesystem paths are never returned.
        </p>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Software Version</h2>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Installed</dt>
            <dd>{lifecycle.version.installedVersion || "Unknown"}</dd>
          </div>
          <div>
            <dt>Latest known upstream</dt>
            <dd>{lifecycle.version.latestVersion || "Unavailable"}</dd>
          </div>
          <div>
            <dt>Controller compatibility</dt>
            <dd>{lifecycle.version.compatibility}</dd>
          </div>
          <div>
            <dt>Workflow</dt>
            <dd>{lifecycle.version.upgradeSupport}</dd>
          </div>
        </dl>
        {lifecycle.version.upgradeSupport === "guided" &&
          node.maintenanceMode && (
            <form
              className="card"
              onSubmit={(event) => void startUpgrade(event)}
            >
              <label>
                Target version
                <input
                  value={targetVersion}
                  onChange={(event) => setTargetVersion(event.target.value)}
                  required
                />
              </label>
              <button className="button" type="submit" disabled={busy !== ""}>
                Start guided upgrade
              </button>
              <p>
                AGH HA Controller records the operation and waits while you
                execute the documented host-side update. It never runs an
                arbitrary command.
              </p>
            </form>
          )}
        {upgrades
          .filter((upgrade) => upgrade.status === "awaiting_operator")
          .map((upgrade) => (
            <article className="card" key={upgrade.id}>
              <h3>Upgrade awaiting validation</h3>
              <p>
                Upgrade {upgrade.fromVersion} to {upgrade.targetVersion} using
                the supported host-side procedure. For Docker, update the pinned
                image and recreate only this node. For native/systemd, use the
                official AdGuard Home package/update procedure and restart only
                this node.
              </p>
              <button
                className="button"
                type="button"
                disabled={busy !== ""}
                onClick={() => void validateUpgrade(upgrade)}
              >
                Run post-upgrade validation
              </button>
            </article>
          ))}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Operational History</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Severity</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {lifecycle.events.map((event) => (
                <tr key={event.id}>
                  <td>{formatTime(event.occurredAt)}</td>
                  <td>{event.eventType}</td>
                  <td>{event.severity}</td>
                  <td>{event.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  async function probe() {
    setBusy("probe");
    try {
      await api.probeDNS(nodeId);
      await load();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }
  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (settings === undefined) return;
    setBusy("settings");
    try {
      await api.saveLifecycleSettings(nodeId, settings);
      await load();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }
  async function enterMaintenance() {
    if (preflight === undefined || node === undefined) return;
    let breakGlass = false,
      confirmation = "";
    if (preflight.breakGlassRequired) {
      breakGlass = window.confirm(
        "This leaves no verified healthy DNS node. Use break glass?",
      );
      if (!breakGlass) return;
      confirmation =
        window.prompt("Type CONTINUE_WITHOUT_DNS_REDUNDANCY") ?? "";
    } else if (!window.confirm(`Enter maintenance on ${node.name}?`)) return;
    setBusy("maintenance");
    try {
      await api.enterMaintenance(node, breakGlass, confirmation);
      await load();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }
  async function returnToService() {
    if (node === undefined) return;
    if (
      !window.confirm(
        "Run all return-to-service checks? The node stays in maintenance if any required check fails.",
      )
    )
      return;
    setBusy("return");
    try {
      await api.returnToService(node);
      await load();
    } catch (caught) {
      setError(caught);
      await load();
    } finally {
      setBusy("");
    }
  }
  async function startUpgrade(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm(`Start a guided upgrade to ${targetVersion}?`)) return;
    setBusy("upgrade");
    try {
      await api.startUpgrade(nodeId, targetVersion);
      await load();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }
  async function validateUpgrade(upgrade: UpgradeOperation) {
    if (node === undefined) return;
    if (
      !window.confirm(
        "Validate the expected version, API, DNS, capabilities, configuration, drift, TLS, DHCP, and return this node to service only on success?",
      )
    )
      return;
    setBusy("validate-upgrade");
    try {
      await api.validateUpgrade(upgrade.id, node.recordVersion);
      await load();
    } catch (caught) {
      setError(caught);
      await load();
    } finally {
      setBusy("");
    }
  }
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value.replaceAll("_", " ")}</strong>
    </article>
  );
}
function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}
