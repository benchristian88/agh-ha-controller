import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  EmptyState,
  ErrorState,
  Loading,
} from "../../components/Feedback";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import type {
  CertificateHealth,
  Cluster,
  HAEvent,
  HASummary,
  Node,
  NotificationChannel,
  UpgradeOperation,
  VersionHealth,
} from "../../lib/types";

export function HAOperationsPage({ cluster }: { cluster: Cluster }) {
  const [summary, setSummary] = useState<HASummary>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [certificates, setCertificates] = useState<CertificateHealth[]>([]);
  const [versions, setVersions] = useState<VersionHealth[]>([]);
  const [events, setEvents] = useState<HAEvent[]>([]);
  const [upgrades, setUpgrades] = useState<UpgradeOperation[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [error, setError] = useState<unknown>();
  const [showWebhook, setShowWebhook] = useState(false);
  const [webhookName, setWebhookName] = useState("");
  const [webhookURL, setWebhookURL] = useState("");

  const load = useCallback(async () => {
    try {
      const [
        ha,
        nodeResult,
        certificateResult,
        versionResult,
        history,
        upgradeResult,
        channelResult,
      ] = await Promise.all([
        api.haStatus(cluster.id),
        api.nodes(cluster.id),
        api.certificates(cluster.id),
        api.versions(cluster.id),
        api.haHistory(cluster.id),
        api.upgrades(cluster.id),
        api.notificationChannels(cluster.id),
      ]);
      setSummary(ha);
      setNodes(nodeResult.items);
      setCertificates(certificateResult.items);
      setVersions(versionResult.items);
      setEvents(history.items);
      setUpgrades(upgradeResult.items);
      setChannels(channelResult.items);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, [cluster.id]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (summary === undefined && error === undefined)
    return <Loading label="Loading HA operations…" />;
  if (summary === undefined)
    return <ErrorState error={error} retry={() => void load()} />;
  const nodeName = new Map(nodes.map((node) => [node.id, node.name]));

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">HA Controller</p>
          <h1>HA Operations</h1>
          <p>
            DNS redundancy, lifecycle work, certificates, software, and
            operational history.
          </p>
        </div>
        <StatusBadge
          status={summary.state === "at_risk" ? "failed" : summary.state}
          label={summary.state === "at_risk" ? "At Risk" : undefined}
        />
      </header>
      {error !== undefined && (
        <Banner tone="warning" title="Refresh failed">
          Showing the last complete HA snapshot.
        </Banner>
      )}
      {summary.state !== "healthy" && (
        <Banner tone="warning" title="HA capacity needs attention">
          {summary.message}
        </Banner>
      )}

      <section className="metrics" aria-label="HA redundancy summary">
        <Metric
          label="DNS serving"
          value={`${summary.servingDnsNodes} / ${summary.totalNodes}`}
        />
        <Metric
          label="API reachable"
          value={`${summary.apiReachableNodes} / ${summary.totalNodes}`}
        />
        <Metric
          label="Converged"
          value={`${summary.convergedNodes} / ${summary.totalNodes}`}
        />
        <Metric label="Maintenance" value={String(summary.maintenanceNodes)} />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Node lifecycle</h2>
            <small>
              Open a node for maintenance, DNS probe, TLS, and guided upgrade
              workflows.
            </small>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Node</th>
                <th>API</th>
                <th>DNS</th>
                <th>Maintenance</th>
                <th>Version</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const version = versions.find(
                  (item) => item.nodeId === node.id,
                );
                const dns = summary.nodes.find(
                  (item) => item.nodeId === node.id,
                );
                return (
                  <tr key={node.id}>
                    <td>
                      <a href={`/ha/nodes/${node.id}`}>
                        <strong>{node.name}</strong>
                      </a>
                    </td>
                    <td>
                      <StatusBadge status={node.healthStatus} />
                    </td>
                    <td>
                      <a href={`/ha/nodes/${node.id}`}>
                        <StatusBadge status={dns?.dnsStatus ?? "unknown"} />
                      </a>
                    </td>
                    <td>
                      {node.maintenanceMode ? (
                        <StatusBadge status="maintenance" />
                      ) : (
                        "In service"
                      )}
                    </td>
                    <td>{node.version ?? "Unknown"}</td>
                    <td>
                      {version?.updateAvailable ? (
                        <StatusBadge status="warning" label="Available" />
                      ) : version?.releaseCheckStale ? (
                        "Check unavailable"
                      ) : (
                        "Current"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Certificate expiry</h2>
          <span>{summary.certificateWarnings} warnings</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Node</th>
                <th>Certificate</th>
                <th>Expiry</th>
                <th>Remaining</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((certificate) => (
                <tr key={certificate.nodeId}>
                  <td>{certificate.nodeName}</td>
                  <td>{certificate.subject || "Not reported"}</td>
                  <td>{formatTime(certificate.notAfter)}</td>
                  <td>
                    {certificate.daysRemaining === undefined
                      ? "—"
                      : `${certificate.daysRemaining} days`}
                  </td>
                  <td>
                    <StatusBadge
                      status={
                        certificate.state === "critical" ||
                        certificate.state === "expired"
                          ? "failed"
                          : certificate.state
                      }
                      label={certificate.state.replaceAll("_", " ")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Guided upgrades</h2>
          <small>
            Atlas coordinates validation; it never opens a remote shell.
          </small>
        </div>
        {upgrades.length === 0 ? (
          <EmptyState title="No upgrade history">
            <p>Start a supported guided upgrade from Node Detail.</p>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Versions</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {upgrades.map((upgrade) => (
                  <tr key={upgrade.id}>
                    <td>{nodeName.get(upgrade.nodeId) ?? upgrade.nodeId}</td>
                    <td>
                      {upgrade.fromVersion} → {upgrade.targetVersion}
                    </td>
                    <td>{upgrade.mode}</td>
                    <td>
                      <StatusBadge
                        status={
                          upgrade.status === "succeeded"
                            ? "success"
                            : upgrade.status === "failed"
                              ? "failed"
                              : "pending"
                        }
                        label={upgrade.status.replaceAll("_", " ")}
                      />
                    </td>
                    <td>{formatTime(upgrade.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Notifications</h2>
            <small>
              Meaningful transitions and recoveries; DNS failures during
              maintenance are suppressed.
            </small>
          </div>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setShowWebhook((value) => !value)}
          >
            Add webhook
          </button>
        </div>
        {showWebhook && (
          <form className="card" onSubmit={(event) => void saveWebhook(event)}>
            <label>
              Channel name
              <input
                value={webhookName}
                onChange={(event) => setWebhookName(event.target.value)}
                required
              />
            </label>
            <label>
              HTTPS webhook URL
              <input
                type="url"
                value={webhookURL}
                onChange={(event) => setWebhookURL(event.target.value)}
                required
              />
            </label>
            <button className="button" type="submit">
              Save encrypted webhook
            </button>
          </form>
        )}
        <ul>
          {channels.map((channel) => (
            <li key={channel.id}>
              <strong>{channel.name}</strong> —{" "}
              {channel.enabled ? "Enabled" : "Paused"} · destination encrypted
            </li>
          ))}
        </ul>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Operational history</h2>
          <small>State transitions, not every successful probe.</small>
        </div>
        {events.length === 0 ? (
          <EmptyState title="No HA transitions recorded" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Node</th>
                  <th>Event</th>
                  <th>Severity</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatTime(event.occurredAt)}</td>
                    <td>
                      {event.nodeId
                        ? (nodeName.get(event.nodeId) ?? event.nodeId)
                        : "Cluster"}
                    </td>
                    <td>{event.eventType}</td>
                    <td>
                      <StatusBadge
                        status={
                          event.severity === "critical"
                            ? "failed"
                            : event.severity
                        }
                      />
                    </td>
                    <td>{event.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );

  async function saveWebhook(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api.saveNotificationChannel(cluster.id, {
        name: webhookName,
        destination: webhookURL,
        enabled: true,
      });
      setWebhookName("");
      setWebhookURL("");
      setShowWebhook(false);
      await load();
    } catch (caught) {
      setError(caught);
    }
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}
