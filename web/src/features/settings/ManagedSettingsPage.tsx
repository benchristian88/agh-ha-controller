import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { api } from "../../lib/api";
import type {
  CapabilityProfile,
  Cluster,
  ConfigurationDraft,
  ConfigurationSnapshot,
  Node,
  ValidationIssue,
} from "../../lib/types";

export type SettingsArea =
  | "dns"
  | "filters"
  | "clients"
  | "rewrites"
  | "privacy"
  | "dhcp"
  | "infrastructure";

const titles: Record<SettingsArea, [string, string]> = {
  dns: [
    "DNS settings",
    "Shared resolver, cache, blocking, and privacy behavior.",
  ],
  filters: [
    "Filters",
    "Shared blocklists, allowlists, custom rules, and refresh operations.",
  ],
  clients: [
    "Persistent clients",
    "Client identities and per-client filtering policy shared by every node.",
  ],
  rewrites: [
    "DNS rewrites",
    "Cluster-wide domain answers managed as an unordered set.",
  ],
  privacy: [
    "General settings",
    "Safety services, Safe Search, query-log, and statistics policy managed across the cluster.",
  ],
  infrastructure: [
    "Encryption",
    "Redacted, node-attributed TLS inventory. Certificate secrets remain outside desired state.",
  ],
  dhcp: [
    "DHCP",
    "Guarded node-specific DHCP configuration with a single active node.",
  ],
};

export function ManagedSettingsPage({
  cluster,
  area,
  heading,
}: {
  cluster: Cluster;
  area: SettingsArea;
  heading?: readonly [title: string, description: string];
}) {
  const [draft, setDraft] = useState<ConfigurationDraft>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [snapshots, setSnapshots] = useState<ConfigurationSnapshot[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityProfile[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [inventory, nodeResult] = await Promise.all([
        api.configurationInventory(cluster.id),
        api.nodes(cluster.id),
      ]);
      setDraft(inventory.draft ?? undefined);
      setSnapshots(inventory.snapshots);
      setCapabilities(inventory.capabilities);
      setNodes(nodeResult.items);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, [cluster.id]);

  useEffect(() => void load(), [load]);

  async function save() {
    if (!draft) return;
    setBusy("save");
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
      setBusy("");
    }
  }

  if (error && draft === undefined)
    return <ErrorState error={error} retry={() => void load()} />;
  if (draft === undefined && nodes.length === 0 && error === undefined)
    return <Loading label="Loading managed settings…" />;

  const [title, description] = heading ?? titles[area];
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">AdGuard Home</p>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
        {draft?.document.schemaVersion === 2 && (
          <button
            className="button"
            type="button"
            disabled={busy !== ""}
            onClick={() => void save()}
          >
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
        )}
      </header>
      {error && <div className="notice notice--error">{String(error)}</div>}
      {!draft ? (
        <EmptyState title="Import a node configuration first">
          <p>
            Open Configuration Control, refresh a node, and import its
            observation to create the cluster draft.
          </p>
        </EmptyState>
      ) : draft.document.schemaVersion !== 2 ? (
        <div className="notice notice--error">
          <strong>Unsupported draft format</strong>
          <p>
            Refresh an AdGuard Home 0.107.78 node observation in Configuration
            Control and import it before editing managed settings.
          </p>
        </div>
      ) : (
        <div>
          {capabilities.some(
            (profile) =>
              profile.schemaVersion === 2 &&
              [
                "cache_toggle",
                "upstream_timeout",
                "filter_interval_arbitrary",
                "rewrite_toggle",
                "ignored_lists_toggle",
              ].some((feature) => !profile.features[feature]),
          ) && (
            <div className="notice notice--info">
              Some patch-level controls are unavailable on older schema-v2
              nodes. You may retain their imported defaults; publication
              preflight blocks only settings that require a missing capability.
            </div>
          )}
          {area === "dns" && <DNSForm draft={draft} setDraft={setDraft} />}
          {area === "filters" && (
            <FiltersForm draft={draft} setDraft={setDraft} />
          )}
          {area === "infrastructure" && (
            <InfrastructureForm nodes={nodes} snapshots={snapshots} />
          )}
          {issues.length > 0 && (
            <div className="notice notice--warning">
              <strong>Validation needs attention</strong>
              <ul>
                {issues.map((issue) => (
                  <li key={`${issue.field}-${issue.message}`}>
                    {issue.field}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {message && (
            <div className="notice notice--success" role="status">
              {message}
            </div>
          )}
        </div>
      )}
    </>
  );
}

type DraftProps = {
  draft: ConfigurationDraft;
  setDraft: (draft: ConfigurationDraft) => void;
};
const lines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
const lineValue = (value?: string[]) => (value ?? []).join("\n");

function DNSForm({ draft, setDraft }: DraftProps) {
  const dns = draft.document.shared.dns;
  const update = (patch: Partial<typeof dns>) =>
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: { ...draft.document.shared, dns: { ...dns, ...patch } },
      },
    });
  return (
    <div className="card form-stack">
      <h2>Resolver behavior</h2>
      <div className="form-grid">
        <TextLines
          label="Upstream DNS (ordered)"
          value={dns.upstreamDns}
          onChange={(value) => update({ upstreamDns: value })}
        />
        <TextLines
          label="Bootstrap DNS"
          value={dns.bootstrapDns}
          onChange={(value) => update({ bootstrapDns: value })}
        />
        <TextLines
          label="Fallback DNS (ordered)"
          value={dns.fallbackDns}
          onChange={(value) => update({ fallbackDns: value })}
        />
        <TextLines
          label="Private reverse DNS"
          value={dns.privateReverseDns}
          onChange={(value) => update({ privateReverseDns: value })}
        />
        <label>
          Upstream mode
          <select
            value={dns.upstreamMode ?? "load_balance"}
            onChange={(event) =>
              update({
                upstreamMode: event.target.value as typeof dns.upstreamMode,
              })
            }
          >
            <option value="load_balance">Load balance</option>
            <option value="parallel">Parallel</option>
            <option value="fastest_addr">Fastest address</option>
          </select>
        </label>
        <NumberField
          label="Rate limit (requests/second; 0 disables)"
          value={dns.rateLimit ?? 0}
          onChange={(value) => update({ rateLimit: value })}
        />
        <NumberField
          label="IPv4 rate-limit subnet"
          value={dns.rateLimitSubnetLengthIpv4 ?? 24}
          onChange={(value) => update({ rateLimitSubnetLengthIpv4: value })}
        />
        <NumberField
          label="IPv6 rate-limit subnet"
          value={dns.rateLimitSubnetLengthIpv6 ?? 56}
          onChange={(value) => update({ rateLimitSubnetLengthIpv6: value })}
        />
        <TextLines
          label="Rate-limit allowlist"
          value={dns.rateLimitAllowlist}
          onChange={(value) => update({ rateLimitAllowlist: value })}
        />
        <label>
          Blocking mode
          <select
            value={dns.blockingMode ?? "default"}
            onChange={(event) =>
              update({
                blockingMode: event.target.value as typeof dns.blockingMode,
              })
            }
          >
            <option value="default">Default</option>
            <option value="refused">REFUSED</option>
            <option value="nxdomain">NXDOMAIN</option>
            <option value="null_ip">Null IP</option>
            <option value="custom_ip">Custom IP</option>
          </select>
        </label>
        <label>
          Custom blocking IPv4
          <input
            value={dns.blockingIpv4 ?? ""}
            onChange={(event) => update({ blockingIpv4: event.target.value })}
          />
        </label>
        <label>
          Custom blocking IPv6
          <input
            value={dns.blockingIpv6 ?? ""}
            onChange={(event) => update({ blockingIpv6: event.target.value })}
          />
        </label>
        <NumberField
          label="Blocked response TTL"
          value={dns.blockedResponseTtl ?? 0}
          onChange={(value) => update({ blockedResponseTtl: value })}
        />
        <NumberField
          label="Cache size (bytes)"
          value={dns.cacheSize ?? 0}
          onChange={(value) => update({ cacheSize: value })}
        />
        <NumberField
          label="Upstream timeout (seconds; 0 uses node default)"
          value={dns.upstreamTimeoutSeconds ?? 0}
          onChange={(value) => update({ upstreamTimeoutSeconds: value })}
        />
        <NumberField
          label="Minimum cache TTL"
          value={dns.cacheTtlMin ?? 0}
          onChange={(value) => update({ cacheTtlMin: value })}
        />
        <NumberField
          label="Maximum cache TTL"
          value={dns.cacheTtlMax ?? 0}
          onChange={(value) => update({ cacheTtlMax: value })}
        />
        <label>
          Custom EDNS client subnet address
          <input
            value={dns.ednsCustomIp ?? ""}
            disabled={!dns.ednsUseCustom}
            onChange={(event) => update({ ednsCustomIp: event.target.value })}
          />
        </label>
      </div>
      <div className="toggle-grid">
        <Check
          label="DNSSEC enabled"
          checked={dns.dnssecEnabled ?? false}
          onChange={(value) => update({ dnssecEnabled: value })}
        />
        <Check
          label="DNS response cache enabled"
          checked={dns.cacheEnabled ?? true}
          onChange={(value) => update({ cacheEnabled: value })}
        />
        <Check
          label="Optimistic cache"
          checked={dns.cacheOptimistic ?? false}
          onChange={(value) => update({ cacheOptimistic: value })}
        />
        <Check
          label="Resolve client names"
          checked={dns.resolveClients ?? false}
          onChange={(value) => update({ resolveClients: value })}
        />
        <Check
          label="Use private reverse resolvers"
          checked={dns.usePrivateReverseResolvers ?? false}
          onChange={(value) => update({ usePrivateReverseResolvers: value })}
        />
        <Check
          label="Disable IPv6 resolution"
          checked={dns.disableIpv6 ?? false}
          onChange={(value) => update({ disableIpv6: value })}
        />
        <Check
          label="EDNS Client Subnet"
          checked={dns.ednsClientSubnet ?? false}
          onChange={(value) => update({ ednsClientSubnet: value })}
        />
        <Check
          label="Use a custom EDNS address"
          checked={dns.ednsUseCustom ?? false}
          onChange={(value) => update({ ednsUseCustom: value })}
        />
      </div>
    </div>
  );
}

function FiltersForm({ draft, setDraft }: DraftProps) {
  const filtering = draft.document.shared.filtering;
  const update = (patch: Partial<typeof filtering>) =>
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: {
          ...draft.document.shared,
          filtering: { ...filtering, ...patch },
        },
      },
    });
  return (
    <div className="card form-stack">
      <h2>Filtering policy</h2>
      <div className="notice notice--info">
        DNS subscriptions are managed on the separate{" "}
        <a href="/filters/blocklists">Blocklists</a> and{" "}
        <a href="/filters/allowlists">Allowlists</a> pages.
      </div>
      <TextLines
        label="Custom filtering rules (ordered)"
        value={filtering.userRules}
        onChange={(value) => update({ userRules: value })}
        rows={12}
      />
    </div>
  );
}

function InfrastructureForm({
  nodes,
  snapshots,
}: {
  nodes: Node[];
  snapshots: ConfigurationSnapshot[];
}) {
  const nodeNames = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.name])),
    [nodes],
  );
  return (
    <div className="form-stack">
      <div className="notice notice--warning">
        <strong>TLS is inventory-only.</strong> Certificate and private-key
        material never enters a revision or browser response. Change TLS in the
        native node UI while in maintenance, then refresh and adopt the
        observation.
      </div>
      <section>
        <h2>TLS inventory</h2>
        <div className="node-grid">
          {snapshots
            .filter((snapshot) => snapshot.document)
            .map((snapshot) => {
              const tls = snapshot.document?.observedOnly.tls;
              return (
                <article className="card" key={snapshot.nodeId}>
                  <h3>{nodeNames.get(snapshot.nodeId) ?? snapshot.nodeId}</h3>
                  {tls ? (
                    <dl className="detail-list">
                      <div>
                        <dt>Encryption</dt>
                        <dd>{tls.enabled ? "Enabled" : "Disabled"}</dd>
                      </div>
                      <div>
                        <dt>Server name</dt>
                        <dd>{tls.serverName || "Not set"}</dd>
                      </div>
                      <div>
                        <dt>HTTPS / DoT / DoQ</dt>
                        <dd>
                          {tls.httpsPort || "—"} / {tls.dnsOverTlsPort || "—"} /{" "}
                          {tls.dnsOverQuicPort || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Certificate</dt>
                        <dd>
                          {tls.validPair ? "Valid pair" : "Needs attention"}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="muted">
                      Refresh this node to collect TLS status.
                    </p>
                  )}
                </article>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function TextLines({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value?: string[];
  onChange: (value: string[]) => void;
  rows?: number;
}) {
  return (
    <label>
      {label}
      <textarea
        rows={rows}
        value={lineValue(value)}
        onChange={(event) => onChange(lines(event.target.value))}
      />
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value?: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        step={step}
        value={value ?? 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
