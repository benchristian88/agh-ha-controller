import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  EmptyState,
  ErrorState,
  Loading,
} from "../../components/Feedback";
import { LeaseTable, type LeaseTableRow } from "../../components/LeaseTable";
import { ConfirmDialog, Dialog } from "../../components/Overlays";
import {
  Field,
  ScopeIndicator,
  SettingsGroup,
} from "../../components/Settings";
import { StatusBadge } from "../../components/StatusBadge";
import { DurationField } from "../../components/StructuredInputs";
import { api } from "../../lib/api";
import type {
  Cluster,
  ConfigurationDraft,
  ConfigurationSnapshot,
  DhcpActiveCheckResult,
  DhcpConfiguration,
  DhcpInterface,
  DhcpInterfaces,
  DhcpStaticLease,
  Node,
  ValidationIssue,
} from "../../lib/types";
import {
  hoursToSeconds,
  isObservationStale,
  secondsToHours,
  validateIPv4Configuration,
  validateStaticLease,
} from "./model";

type InterfaceState =
  | { status: "loading" }
  | { status: "ready"; data: DhcpInterfaces }
  | { status: "error"; error: unknown };

export function DHCPPage({ cluster }: { cluster: Cluster }) {
  const [draft, setDraft] = useState<ConfigurationDraft>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [snapshots, setSnapshots] = useState<ConfigurationSnapshot[]>([]);
  const [interfaces, setInterfaces] = useState<Record<string, InterfaceState>>(
    {},
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState("");

  const loadInterfaces = useCallback(async (nodeId: string) => {
    setInterfaces((current) => ({
      ...current,
      [nodeId]: { status: "loading" },
    }));
    try {
      const data = await api.dhcpInterfaces(nodeId);
      setInterfaces((current) => ({
        ...current,
        [nodeId]: { status: "ready", data },
      }));
    } catch (caught) {
      setInterfaces((current) => ({
        ...current,
        [nodeId]: { status: "error", error: caught },
      }));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inventory, nodeResult] = await Promise.all([
        api.configurationInventory(cluster.id),
        api.nodes(cluster.id),
      ]);
      setDraft(inventory.draft ?? undefined);
      setSnapshots(inventory.snapshots);
      setNodes(nodeResult.items);
      setError(undefined);
      setLoading(false);
      for (const node of nodeResult.items.filter((item) => item.enabled))
        void loadInterfaces(node.id);
    } catch (caught) {
      setError(caught);
      setLoading(false);
    }
  }, [cluster.id, loadInterfaces]);

  useEffect(() => void load(), [load]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api.updateConfigurationDraft(
        cluster.id,
        draft.version,
        draft.document,
      );
      setDraft(result.draft);
      setIssues(result.issues);
      setMessage(
        "Draft saved. Publish and deploy it from Configuration Control when you are ready.",
      );
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  function setDhcp(nodeId: string, dhcp: DhcpConfiguration) {
    if (!draft) return;
    const overrides = { ...draft.document.nodeOverrides };
    if (dhcp.enabled) {
      for (const [otherNodeId, override] of Object.entries(overrides)) {
        if (otherNodeId !== nodeId && override.dhcp?.enabled)
          overrides[otherNodeId] = {
            ...override,
            dhcp: { ...override.dhcp, enabled: false },
          };
      }
    }
    const current = overrides[nodeId];
    overrides[nodeId] = {
      bindHosts: current?.bindHosts ?? [],
      dnsPort: current?.dnsPort ?? 53,
      dhcp,
    };
    setDraft({
      ...draft,
      document: { ...draft.document, nodeOverrides: overrides },
    });
    setMessage("");
  }

  if (loading) return <Loading label="Loading DHCP settings…" />;
  if (error && draft === undefined)
    return <ErrorState error={error} retry={() => void load()} />;
  if (!draft)
    return (
      <EmptyState title="Import a node configuration first">
        <p>
          Open Configuration Control, refresh a node, and import its observation
          to create the cluster draft.
        </p>
      </EmptyState>
    );
  if (draft.document.schemaVersion !== 2)
    return (
      <Banner tone="danger" title="Unsupported draft format">
        Refresh and import a supported schema-v2 node before editing DHCP.
      </Banner>
    );

  const enabledNodes = nodes.filter((node) => node.enabled);
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">AdGuard Home · node-specific</p>
          <h1>DHCP</h1>
          <p className="muted">
            Guarded per-node DHCP configuration with one designated active node.
          </p>
        </div>
        <button
          className="button"
          type="button"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save Draft"}
        </button>
      </header>
      {error && (
        <Banner tone="danger" title="The last operation failed">
          {String(error)}
        </Banner>
      )}
      <DHCPHAStatus draft={draft} nodes={enabledNodes} snapshots={snapshots} />
      {enabledNodes.length === 0 ? (
        <EmptyState title="No enabled nodes">
          <p>
            Enable a node before inspecting or configuring its DHCP service.
          </p>
        </EmptyState>
      ) : (
        <div className="dhcp-node-list">
          {enabledNodes.map((node) => {
            const dhcp = draft.document.nodeOverrides[node.id]?.dhcp;
            const snapshot = snapshots.find(
              (item) => item.nodeId === node.id && item.document !== undefined,
            );
            return dhcp ? (
              <DHCPNodeSection
                key={node.id}
                node={node}
                dhcp={dhcp}
                snapshot={snapshot}
                interfaceState={interfaces[node.id] ?? { status: "loading" }}
                retryInterfaces={() => void loadInterfaces(node.id)}
                update={(value) => setDhcp(node.id, value)}
              />
            ) : (
              <SettingsGroup
                key={node.id}
                title={node.name}
                description="Node-specific DHCP scope"
              >
                <div className="dhcp-group-content">
                  <Banner tone="warning" title="DHCP unavailable">
                    Refresh and import this node before managing DHCP. No shared
                    listener is assumed.
                  </Banner>
                </div>
              </SettingsGroup>
            );
          })}
        </div>
      )}
      {issues.length > 0 && (
        <Banner tone="warning" title="Server validation needs attention">
          <ul className="compact-list">
            {issues.map((issue) => (
              <li key={`${issue.field}-${issue.message}`}>
                {issue.field}: {issue.message}
              </li>
            ))}
          </ul>
        </Banner>
      )}
      {message && (
        <Banner tone="success" title="Draft saved">
          {message}
        </Banner>
      )}
    </>
  );
}

function DHCPHAStatus({
  draft,
  nodes,
  snapshots,
}: {
  draft: ConfigurationDraft;
  nodes: Node[];
  snapshots: ConfigurationSnapshot[];
}) {
  const names = new Map(nodes.map((node) => [node.id, node.name]));
  const desired = nodes.find(
    (node) => draft.document.nodeOverrides[node.id]?.dhcp?.enabled,
  );
  const observed = snapshots.filter(
    (snapshot) => snapshot.document?.nodeSpecific.dhcp?.enabled,
  );
  const handoff =
    desired !== undefined &&
    (observed.length !== 1 || observed[0]?.nodeId !== desired.id);
  return (
    <SettingsGroup
      title="HA DHCP status"
      description="DHCP listeners remain independent per node; the cluster does not expose one shared listener."
    >
      <div className="dhcp-status-grid">
        <dl>
          <div>
            <dt>Designated active node</dt>
            <dd>{desired?.name ?? "None"}</dd>
          </div>
          <div>
            <dt>Currently observed active</dt>
            <dd>
              {observed.length === 0
                ? "None observed"
                : observed
                    .map((item) => names.get(item.nodeId) ?? item.nodeId)
                    .join(", ")}
            </dd>
          </div>
          <div>
            <dt>Safety boundary</dt>
            <dd>
              <StatusBadge
                status={observed.length > 1 ? "failed" : "success"}
                label={
                  observed.length > 1
                    ? "Multiple observed"
                    : "One active maximum"
                }
              />
            </dd>
          </div>
        </dl>
        <Banner
          tone={observed.length > 1 ? "danger" : "warning"}
          title="One-active-node design"
        >
          Enabling a draft node clears the enabled flag on other draft nodes.
          Server validation remains authoritative.
          {handoff && (
            <p>
              <strong>Planned handoff:</strong> deployment disables
              desired-inactive nodes before enabling {desired.name}. A failure
              can leave DHCP safely disabled.
            </p>
          )}
        </Banner>
      </div>
    </SettingsGroup>
  );
}

function DHCPNodeSection({
  node,
  dhcp,
  snapshot,
  interfaceState,
  retryInterfaces,
  update,
}: {
  node: Node;
  dhcp: DhcpConfiguration;
  snapshot?: ConfigurationSnapshot;
  interfaceState: InterfaceState;
  retryInterfaces: () => void;
  update: (dhcp: DhcpConfiguration) => void;
}) {
  const [check, setCheck] = useState<{
    loading: boolean;
    result?: DhcpActiveCheckResult;
    error?: unknown;
  }>({ loading: false });
  const ipv4Errors = validateIPv4Configuration(dhcp.ipv4);
  const discovered =
    interfaceState.status === "ready" ? interfaceState.data.interfaces : [];
  const selected = discovered.find((item) => item.name === dhcp.interfaceName);
  const legacyUnknown =
    dhcp.interfaceName !== "" &&
    interfaceState.status === "ready" &&
    selected === undefined;
  const stale = snapshot ? isObservationStale(snapshot.observedAt) : true;

  async function runCheck() {
    setCheck({ loading: true });
    try {
      setCheck({
        loading: false,
        result: await api.checkActiveDhcp(node.id, dhcp.interfaceName),
      });
    } catch (caught) {
      setCheck({ loading: false, error: caught });
    }
  }

  return (
    <article
      className="dhcp-node-section"
      aria-labelledby={`dhcp-node-${node.id}`}
    >
      <header className="dhcp-node-heading">
        <div>
          <ScopeIndicator scope="node" label={node.name} />
          <h2 id={`dhcp-node-${node.id}`}>{node.name} DHCP</h2>
          <p className="muted">
            Desired and observed values below apply only to this node.
          </p>
        </div>
        <label className="checkbox dhcp-active-toggle">
          <input
            type="checkbox"
            checked={dhcp.enabled}
            onChange={(event) =>
              update({ ...dhcp, enabled: event.target.checked })
            }
          />
          Designated active DHCP node
        </label>
      </header>

      <SettingsGroup
        title="Interface"
        description="Discovered directly through the controller for this node."
      >
        <div className="dhcp-group-content">
          {interfaceState.status === "loading" && (
            <Loading label={`Discovering interfaces on ${node.name}…`} />
          )}
          {interfaceState.status === "error" && (
            <>
              <ErrorState
                error={interfaceState.error}
                retry={retryInterfaces}
              />
              <Field
                label="Network interface"
                htmlFor={`dhcp-interface-fallback-${node.id}`}
                help="The imported value is preserved while discovery is unavailable."
              >
                <select
                  id={`dhcp-interface-fallback-${node.id}`}
                  value={dhcp.interfaceName}
                  disabled
                >
                  <option value={dhcp.interfaceName}>
                    {dhcp.interfaceName || "No imported interface"}
                  </option>
                </select>
              </Field>
              {dhcp.interfaceName && (
                <Banner tone="warning" title="Using preserved interface value">
                  <span className="monospace">{dhcp.interfaceName}</span> has
                  not been verified by interface discovery.
                </Banner>
              )}
            </>
          )}
          {interfaceState.status === "ready" && (
            <>
              <Field
                label="Network interface"
                htmlFor={`dhcp-interface-${node.id}`}
                required={dhcp.enabled}
                error={
                  dhcp.enabled && dhcp.interfaceName === ""
                    ? "Select an interface before enabling DHCP."
                    : undefined
                }
                help="Unavailable interfaces remain visible but cannot be newly selected."
              >
                <select
                  id={`dhcp-interface-${node.id}`}
                  value={dhcp.interfaceName}
                  onChange={(event) =>
                    update({ ...dhcp, interfaceName: event.target.value })
                  }
                >
                  <option value="">Select an interface</option>
                  {legacyUnknown && (
                    <option value={dhcp.interfaceName}>
                      {dhcp.interfaceName} · legacy value
                    </option>
                  )}
                  {discovered.map((item) => (
                    <option
                      key={item.name}
                      value={item.name}
                      disabled={
                        !item.available && item.name !== dhcp.interfaceName
                      }
                    >
                      {item.name}
                      {item.available ? "" : " · unavailable"}
                    </option>
                  ))}
                </select>
              </Field>
              {legacyUnknown && (
                <Banner tone="warning" title="Legacy interface not discovered">
                  The imported value{" "}
                  <span className="monospace">{dhcp.interfaceName}</span> is
                  preserved. Select a discovered interface deliberately before
                  changing it.
                </Banner>
              )}
              {discovered.length === 0 && (
                <Banner tone="warning" title="No interfaces found">
                  The node returned an empty interface catalogue.
                </Banner>
              )}
              {selected && (
                <InterfaceDetails
                  value={selected}
                  fetchedAt={interfaceState.data.fetchedAt}
                />
              )}
            </>
          )}
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Active-DHCP check"
        description="A non-mutating preflight against the selected node and interface. It never changes the draft."
        actions={
          <button
            type="button"
            className="button button--secondary"
            disabled={check.loading || dhcp.interfaceName === ""}
            onClick={() => void runCheck()}
          >
            {check.loading ? "Checking…" : "Check for active DHCP"}
          </button>
        }
      >
        <div className="dhcp-group-content">
          <p>
            <strong>Target:</strong> {node.name} /{" "}
            <span className="monospace">
              {dhcp.interfaceName || "no interface selected"}
            </span>
          </p>
          {check.error !== undefined && (
            <ErrorState error={check.error} retry={() => void runCheck()} />
          )}
          {check.result ? (
            <ActiveCheckPanel result={check.result} />
          ) : (
            !check.error && (
              <p className="muted">
                Run this check before enabling DHCP or handing the role to this
                node.
              </p>
            )
          )}
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="IPv4 configuration"
        description="Gateway and lease range must share one subnet."
      >
        <div className="dhcp-network-grid">
          <DHCPTextField
            id={`${node.id}-gateway`}
            label="Gateway"
            value={dhcp.ipv4.gateway}
            error={ipv4Errors.gateway}
            onChange={(gateway) =>
              update({ ...dhcp, ipv4: { ...dhcp.ipv4, gateway } })
            }
          />
          <DHCPTextField
            id={`${node.id}-mask`}
            label="Subnet mask"
            value={dhcp.ipv4.subnetMask}
            error={ipv4Errors.subnetMask}
            onChange={(subnetMask) =>
              update({ ...dhcp, ipv4: { ...dhcp.ipv4, subnetMask } })
            }
          />
          <DHCPTextField
            id={`${node.id}-start`}
            label="Range start"
            value={dhcp.ipv4.rangeStart}
            error={ipv4Errors.rangeStart}
            onChange={(rangeStart) =>
              update({ ...dhcp, ipv4: { ...dhcp.ipv4, rangeStart } })
            }
          />
          <DHCPTextField
            id={`${node.id}-end`}
            label="Range end"
            value={dhcp.ipv4.rangeEnd}
            error={ipv4Errors.rangeEnd}
            onChange={(rangeEnd) =>
              update({ ...dhcp, ipv4: { ...dhcp.ipv4, rangeEnd } })
            }
          />
          <DurationField
            label="Lease duration"
            value={secondsToHours(dhcp.ipv4.leaseDurationSeconds)}
            unit="hours"
            min={1 / 60}
            presets={[
              { label: "1 hour", value: 1 },
              { label: "8 hours", value: 8 },
              { label: "24 hours", value: 24 },
              { label: "7 days", value: 168 },
            ]}
            onChange={(hours) =>
              update({
                ...dhcp,
                ipv4: {
                  ...dhcp.ipv4,
                  leaseDurationSeconds: hoursToSeconds(hours),
                },
              })
            }
          />
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="IPv6"
        description="Only the IPv6 range start and lease duration already supported by schema v2 are managed."
      >
        <div className="dhcp-network-grid">
          <DHCPTextField
            id={`${node.id}-v6-start`}
            label="IPv6 range start"
            value={dhcp.ipv6.rangeStart}
            onChange={(rangeStart) =>
              update({ ...dhcp, ipv6: { ...dhcp.ipv6, rangeStart } })
            }
          />
          <DurationField
            label="IPv6 lease duration"
            value={secondsToHours(dhcp.ipv6.leaseDurationSeconds)}
            unit="hours"
            min={0}
            presets={[
              { label: "Not configured", value: 0 },
              { label: "1 hour", value: 1 },
              { label: "24 hours", value: 24 },
              { label: "7 days", value: 168 },
            ]}
            onChange={(hours) =>
              update({
                ...dhcp,
                ipv6: {
                  ...dhcp.ipv6,
                  leaseDurationSeconds: hoursToSeconds(hours),
                },
              })
            }
          />
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Active leases"
        description="Observed-only runtime leases; these rows never enter desired state or drift."
      >
        <div className="dhcp-group-content">
          <ActiveLeases node={node} snapshot={snapshot} stale={stale} />
        </div>
      </SettingsGroup>

      <StaticLeases
        node={node}
        value={dhcp.staticLeases}
        onChange={(staticLeases) => update({ ...dhcp, staticLeases })}
      />
    </article>
  );
}

function InterfaceDetails({
  value,
  fetchedAt,
}: {
  value: DhcpInterface;
  fetchedAt: string;
}) {
  return (
    <dl className="dhcp-interface-details">
      <div>
        <dt>Availability</dt>
        <dd>{value.available ? "Available" : "Unavailable"}</dd>
      </div>
      <div>
        <dt>Hardware address</dt>
        <dd className="monospace">{value.hardwareAddress || "Not reported"}</dd>
      </div>
      <div>
        <dt>IPv4 addresses</dt>
        <dd>{value.ipv4Addresses.join(", ") || "None"}</dd>
      </div>
      <div>
        <dt>IPv6 addresses</dt>
        <dd>{value.ipv6Addresses.join(", ") || "None"}</dd>
      </div>
      <div>
        <dt>Gateway</dt>
        <dd>{value.gatewayIp || "Not reported"}</dd>
      </div>
      <div>
        <dt>Flags</dt>
        <dd>{value.flags.join(", ") || "None"}</dd>
      </div>
      <div>
        <dt>Discovered</dt>
        <dd>{formatTimestamp(fetchedAt)}</dd>
      </div>
    </dl>
  );
}

function ActiveCheckPanel({ result }: { result: DhcpActiveCheckResult }) {
  const copy = {
    none: ["success", "No other active DHCP server detected"],
    found: ["warning", "Another active DHCP server was detected"],
    multiple: ["danger", "Active DHCP was detected for IPv4 and IPv6"],
    partial: ["warning", "The check returned a partial result"],
    error: ["danger", "The node could not complete the check"],
  } as const;
  const [tone, title] = copy[result.status];
  return (
    <Banner tone={tone} title={title}>
      <dl className="dhcp-check-results">
        <div>
          <dt>IPv4 other server</dt>
          <dd>
            {checkLabel(result.ipv4.status)}
            {result.ipv4.message ? ` · ${result.ipv4.message}` : ""}
          </dd>
        </div>
        <div>
          <dt>IPv6 other server</dt>
          <dd>
            {checkLabel(result.ipv6.status)}
            {result.ipv6.message ? ` · ${result.ipv6.message}` : ""}
          </dd>
        </div>
        <div>
          <dt>Node interface IP</dt>
          <dd>
            {checkLabel(result.ipv4StaticIp.status)}
            {result.ipv4StaticIp.ip ? ` · ${result.ipv4StaticIp.ip}` : ""}
          </dd>
        </div>
        <div>
          <dt>Checked</dt>
          <dd>{formatTimestamp(result.checkedAt)}</dd>
        </div>
      </dl>
    </Banner>
  );
}

function DHCPTextField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <input
        id={id}
        value={value}
        aria-invalid={error !== undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function ActiveLeases({
  node,
  snapshot,
  stale,
}: {
  node: Node;
  snapshot?: ConfigurationSnapshot;
  stale: boolean;
}) {
  const rows: LeaseTableRow[] = (
    snapshot?.document?.observedOnly.dhcpLeases ?? []
  ).map((lease, index) => ({
    id: `${lease.mac}-${lease.ip}-${index}`,
    client: lease.hostname || lease.mac || "Unknown client",
    address: lease.ip,
    mac: lease.mac,
    node: node.name,
    expiry: lease.expiresAt ? formatTimestamp(lease.expiresAt) : "Not reported",
    observation: snapshot ? (
      <>
        <span>{stale ? "Stale" : "Fresh"}</span>
        <small>{formatTimestamp(snapshot.observedAt)}</small>
      </>
    ) : (
      "Unavailable"
    ),
  }));
  return (
    <>
      {snapshot && (
        <p className="dhcp-freshness">
          <StatusBadge
            status={stale ? "stale" : "observed"}
            label={stale ? "Stale observation" : "Fresh observation"}
          />{" "}
          Last observed {formatTimestamp(snapshot.observedAt)}
        </p>
      )}
      <LeaseTable
        rows={rows}
        caption={`Active leases observed on ${node.name}`}
        observed
        stale={stale && rows.length > 0}
        emptyTitle="No active leases observed"
        emptyDescription={
          snapshot
            ? "The latest successful observation contained no active leases."
            : "Refresh this node to collect active leases and freshness."
        }
      />
    </>
  );
}

function StaticLeases({
  node,
  value,
  onChange,
}: {
  node: Node;
  value: DhcpStaticLease[];
  onChange: (value: DhcpStaticLease[]) => void;
}) {
  const [editor, setEditor] = useState<{
    index?: number;
    lease: DhcpStaticLease;
  }>();
  const [remove, setRemove] = useState<{
    index: number;
    lease: DhcpStaticLease;
  }>();
  const errors = editor
    ? validateStaticLease(editor.lease, value, editor.index)
    : {};
  const valid = editor !== undefined && Object.keys(errors).length === 0;
  const rows: LeaseTableRow[] = value.map((lease, index) => ({
    id: `${lease.mac}-${lease.ip}-${index}`,
    client: lease.hostname,
    address: lease.ip,
    mac: lease.mac,
    node: node.name,
    actions: (
      <span className="dhcp-table-actions">
        <button
          type="button"
          className="button button--quiet"
          onClick={() => setEditor({ index, lease: { ...lease } })}
        >
          Edit
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={() => setRemove({ index, lease })}
        >
          Remove
        </button>
      </span>
    ),
  }));

  function commit() {
    if (!editor || !valid) return;
    const lease = {
      mac: editor.lease.mac.trim().toLowerCase(),
      ip: editor.lease.ip.trim(),
      hostname: editor.lease.hostname.trim(),
    };
    onChange(
      editor.index === undefined
        ? [...value, lease]
        : value.map((current, index) =>
            index === editor.index ? lease : current,
          ),
    );
    setEditor(undefined);
  }

  return (
    <SettingsGroup
      title="Static leases"
      description="Draft-managed leases. An edit may deploy as a verified remove-then-add operation."
      actions={
        <button
          type="button"
          className="button button--secondary"
          onClick={() =>
            setEditor({ lease: { mac: "", ip: "", hostname: "" } })
          }
        >
          Add static lease
        </button>
      }
    >
      <div className="dhcp-group-content">
        <LeaseTable
          rows={rows}
          caption={`Static leases for ${node.name}`}
          emptyTitle="No static leases"
          emptyDescription="Add a reservation for this node's DHCP service."
        />
      </div>
      <Dialog
        open={editor !== undefined}
        onClose={() => setEditor(undefined)}
        title={
          editor?.index === undefined ? "Add static lease" : "Edit static lease"
        }
        description={`Draft-only change for ${node.name}. Save Draft, Publish, and Deploy remain separate.`}
        actions={
          <>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setEditor(undefined)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button"
              disabled={!valid}
              onClick={commit}
            >
              {editor?.index === undefined ? "Add lease" : "Save lease"}
            </button>
          </>
        }
      >
        {editor && (
          <div className="dhcp-lease-fields">
            <DHCPTextField
              id="static-lease-mac"
              label="MAC address"
              value={editor.lease.mac}
              error={errors.mac}
              onChange={(mac) =>
                setEditor({ ...editor, lease: { ...editor.lease, mac } })
              }
            />
            <DHCPTextField
              id="static-lease-ip"
              label="IP address"
              value={editor.lease.ip}
              error={errors.ip}
              onChange={(ip) =>
                setEditor({ ...editor, lease: { ...editor.lease, ip } })
              }
            />
            <DHCPTextField
              id="static-lease-hostname"
              label="Hostname"
              value={editor.lease.hostname}
              error={errors.hostname}
              onChange={(hostname) =>
                setEditor({ ...editor, lease: { ...editor.lease, hostname } })
              }
            />
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={remove !== undefined}
        onClose={() => setRemove(undefined)}
        onConfirm={() => {
          if (!remove) return;
          onChange(value.filter((_, index) => index !== remove.index));
          setRemove(undefined);
        }}
        title="Remove static lease from draft?"
        description={`This removes ${remove?.lease.hostname ?? "the lease"} from ${node.name}'s draft only.`}
        confirmLabel="Remove from draft"
      >
        Nodes remain unchanged until the draft is saved, published, and
        deployed.
      </ConfirmDialog>
    </SettingsGroup>
  );
}

function checkLabel(status: string) {
  return (
    (
      {
        yes: "Yes",
        no: "No",
        error: "Check failed",
        unavailable: "Unavailable",
      } as Record<string, string>
    )[status] ?? status
  );
}

function formatTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed)
    ? "Not reported"
    : new Date(parsed).toLocaleString();
}
