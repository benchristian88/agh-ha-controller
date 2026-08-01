import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { api } from "../../lib/api";
import type {
  CapabilityProfile,
  Cluster,
  ConfigurationDraft,
  ConfigurationSnapshot,
  DhcpConfiguration,
  DhcpStaticLease,
  Node,
  PersistentClient,
  Rewrite,
  SafeSearchConfiguration,
  Schedule,
  ValidationIssue,
} from "../../lib/types";
import {
  createEditorRowKey,
  formatTimeOfDay,
  parseTimeOfDay,
} from "./settings";

export type SettingsArea =
  | "dns"
  | "filters"
  | "clients"
  | "rewrites"
  | "services"
  | "privacy"
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
  services: [
    "Services and safety",
    "Blocked services, Safe Browsing, parental controls, and Safe Search.",
  ],
  privacy: [
    "Logs and statistics",
    "Node-local query-log and statistics collection policy. No data is ingested by the controller in 0.4.",
  ],
  infrastructure: [
    "TLS and DHCP",
    "Redacted TLS inventory and guarded single-active-node DHCP configuration.",
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
        <div className="notice notice--warning">
          <strong>Schema upgrade required</strong>
          <p>
            This draft is the immutable 0.3 schema-v1 shape. Refresh and import
            a current node observation from Configuration Control before editing
            0.4 features.
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
            <FiltersForm
              draft={draft}
              setDraft={setDraft}
              nodes={nodes}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              setMessage={setMessage}
            />
          )}
          {area === "clients" && (
            <ClientsForm draft={draft} setDraft={setDraft} />
          )}
          {area === "rewrites" && (
            <RewritesForm draft={draft} setDraft={setDraft} />
          )}
          {area === "services" && (
            <ServicesForm draft={draft} setDraft={setDraft} />
          )}
          {area === "privacy" && (
            <PrivacyForm draft={draft} setDraft={setDraft} />
          )}
          {area === "infrastructure" && (
            <InfrastructureForm
              draft={draft}
              setDraft={setDraft}
              nodes={nodes}
              snapshots={snapshots}
            />
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
          label="Protection enabled"
          checked={dns.protectionEnabled ?? false}
          onChange={(value) => update({ protectionEnabled: value })}
        />
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

function FiltersForm({
  draft,
  setDraft,
  nodes,
  busy,
  setBusy,
  setError,
  setMessage,
}: DraftProps & {
  nodes: Node[];
  busy: string;
  setBusy: (value: string) => void;
  setError: (value: unknown) => void;
  setMessage: (value: string) => void;
}) {
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
  async function refresh(whitelist: boolean) {
    const targets = nodes.filter(
      (node) => node.enabled && !node.maintenanceMode,
    );
    if (
      !window.confirm(
        `Refresh ${whitelist ? "allowlist" : "blocklist"} subscriptions on ${targets.length} node(s)?`,
      )
    )
      return;
    setBusy(whitelist ? "refresh-allow" : "refresh-block");
    setMessage("");
    try {
      const results = await Promise.allSettled(
        targets.map((node) => api.refreshFilters(node.id, whitelist)),
      );
      const failed = results
        .map((result, index) =>
          result.status === "rejected"
            ? (targets[index]?.name ?? "Unknown node")
            : "",
        )
        .filter(Boolean);
      const succeeded = results.length - failed.length;
      setMessage(
        `Refresh succeeded on ${succeeded} of ${targets.length} node(s).`,
      );
      if (failed.length > 0) {
        setError(
          new Error(
            `Refresh failed on: ${failed.join(", ")}. Each result was audited.`,
          ),
        );
      } else {
        setError(undefined);
      }
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="card form-stack">
      <h2>Filtering policy</h2>
      <div className="form-grid">
        <Check
          label="Filtering enabled"
          checked={filtering.enabled}
          onChange={(value) => update({ enabled: value })}
        />
        <NumberField
          label="Automatic update interval (hours)"
          value={filtering.updateIntervalHours}
          onChange={(value) => update({ updateIntervalHours: value })}
        />
        <TextLines
          label="Blocklist subscriptions"
          value={filtering.filterUrls}
          onChange={(value) => update({ filterUrls: value })}
          rows={7}
        />
        <TextLines
          label="Allowlist subscriptions"
          value={filtering.whitelistUrls}
          onChange={(value) => update({ whitelistUrls: value })}
          rows={7}
        />
      </div>
      <TextLines
        label="Custom filtering rules (ordered)"
        value={filtering.userRules}
        onChange={(value) => update({ userRules: value })}
        rows={12}
      />
      <div className="row-actions row-actions--start">
        <button
          className="button button--secondary"
          type="button"
          disabled={busy !== ""}
          onClick={() => void refresh(false)}
        >
          Refresh blocklists
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={busy !== ""}
          onClick={() => void refresh(true)}
        >
          Refresh allowlists
        </button>
      </div>
    </div>
  );
}

const emptySafeSearch = (): SafeSearchConfiguration => ({
  enabled: false,
  bing: true,
  duckDuckGo: true,
  ecosia: true,
  google: true,
  pixabay: true,
  yandex: true,
  youTube: true,
});
function emptyClient(): PersistentClient {
  return {
    name: "",
    ids: [],
    useGlobalSettings: true,
    filteringEnabled: true,
    parentalEnabled: false,
    safeBrowsingEnabled: false,
    safeSearch: emptySafeSearch(),
    useGlobalBlockedServices: true,
    blockedServices: [],
    blockedServicesSchedule: { timeZone: "Local", days: {} },
    upstreams: [],
    upstreamsCacheEnabled: false,
    upstreamsCacheSize: 0,
    tags: [],
    ignoreQueryLog: false,
    ignoreStatistics: false,
  };
}

function ClientsForm({ draft, setDraft }: DraftProps) {
  const clients = draft.document.shared.clients ?? [];
  const [clientKeys, setClientKeys] = useState(() =>
    clients.map(() => createEditorRowKey("client")),
  );
  const setClients = (value: PersistentClient[]) =>
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: { ...draft.document.shared, clients: value },
      },
    });
  const addClient = () => {
    setClientKeys([...clientKeys, createEditorRowKey("client")]);
    setClients([...clients, emptyClient()]);
  };
  const removeClient = (index: number) => {
    setClientKeys(clientKeys.filter((_, itemIndex) => itemIndex !== index));
    setClients(clients.filter((_, itemIndex) => itemIndex !== index));
  };
  return (
    <div className="form-stack">
      <div className="section-heading">
        <h2>Managed clients</h2>
        <button
          type="button"
          className="button button--secondary"
          onClick={addClient}
        >
          Add client
        </button>
      </div>
      {clients.length === 0 ? (
        <EmptyState title="No persistent clients">
          <p>
            Add a client to manage its identity and policy across every node.
          </p>
        </EmptyState>
      ) : (
        clients.map((client, index) => {
          const update = (patch: Partial<PersistentClient>) =>
            setClients(
              clients.map((item, itemIndex) =>
                itemIndex === index ? { ...item, ...patch } : item,
              ),
            );
          return (
            <fieldset className="card" key={clientKeys[index]}>
              <legend className="visually-hidden">
                Client {index + 1} settings
              </legend>
              <h3 className="form-card__title">Client {index + 1}</h3>
              <div className="form-grid">
                <label>
                  Name
                  <input
                    value={client.name}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </label>
                <TextLines
                  label="Identifiers (IP, CIDR, MAC, or ClientID)"
                  value={client.ids}
                  onChange={(value) => update({ ids: value })}
                />
                <TextLines
                  label="Client-specific upstreams (ordered)"
                  value={client.upstreams}
                  onChange={(value) => update({ upstreams: value })}
                />
                <TextLines
                  label="Tags"
                  value={client.tags}
                  onChange={(value) => update({ tags: value })}
                />
                <TextLines
                  label="Blocked services"
                  value={client.blockedServices}
                  onChange={(value) => update({ blockedServices: value })}
                />
                <NumberField
                  label="Per-client upstream cache size"
                  value={client.upstreamsCacheSize}
                  onChange={(value) => update({ upstreamsCacheSize: value })}
                />
              </div>
              <div className="toggle-grid">
                <Check
                  label="Use global filtering settings"
                  checked={client.useGlobalSettings}
                  onChange={(value) => update({ useGlobalSettings: value })}
                />
                <Check
                  label="Filtering"
                  checked={client.filteringEnabled}
                  onChange={(value) => update({ filteringEnabled: value })}
                />
                <Check
                  label="Safe Browsing"
                  checked={client.safeBrowsingEnabled}
                  onChange={(value) => update({ safeBrowsingEnabled: value })}
                />
                <Check
                  label="Parental controls"
                  checked={client.parentalEnabled}
                  onChange={(value) => update({ parentalEnabled: value })}
                />
                <Check
                  label="Use global blocked services"
                  checked={client.useGlobalBlockedServices}
                  onChange={(value) =>
                    update({ useGlobalBlockedServices: value })
                  }
                />
                <Check
                  label="Cache client-specific upstream responses"
                  checked={client.upstreamsCacheEnabled}
                  onChange={(value) => update({ upstreamsCacheEnabled: value })}
                />
                <Check
                  label="Client Safe Search"
                  checked={client.safeSearch.enabled}
                  onChange={(value) =>
                    update({
                      safeSearch: { ...client.safeSearch, enabled: value },
                    })
                  }
                />
                {!client.useGlobalSettings &&
                  client.safeSearch.enabled &&
                  (
                    [
                      "bing",
                      "duckDuckGo",
                      "ecosia",
                      "google",
                      "pixabay",
                      "yandex",
                      "youTube",
                    ] as const
                  ).map((engine) => (
                    <Check
                      key={engine}
                      label={`Client Safe Search: ${engine}`}
                      checked={client.safeSearch[engine]}
                      onChange={(value) =>
                        update({
                          safeSearch: { ...client.safeSearch, [engine]: value },
                        })
                      }
                    />
                  ))}
                <Check
                  label="Exclude from query log"
                  checked={client.ignoreQueryLog}
                  onChange={(value) => update({ ignoreQueryLog: value })}
                />
                <Check
                  label="Exclude from statistics"
                  checked={client.ignoreStatistics}
                  onChange={(value) => update({ ignoreStatistics: value })}
                />
              </div>
              {!client.useGlobalBlockedServices && (
                <ScheduleEditor
                  value={client.blockedServicesSchedule}
                  onChange={(value) =>
                    update({ blockedServicesSchedule: value })
                  }
                  label="Client blocked-services schedule"
                />
              )}
              <button
                type="button"
                className="button button--danger"
                onClick={() => removeClient(index)}
              >
                Remove client
              </button>
            </fieldset>
          );
        })
      )}
    </div>
  );
}

function RewritesForm({ draft, setDraft }: DraftProps) {
  const rewrites = draft.document.shared.rewrites ?? [];
  const [rewriteKeys, setRewriteKeys] = useState(() =>
    rewrites.map(() => createEditorRowKey("rewrite")),
  );
  const setRewrites = (value: Rewrite[]) =>
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: { ...draft.document.shared, rewrites: value },
      },
    });
  const addRewrite = () => {
    setRewriteKeys([...rewriteKeys, createEditorRowKey("rewrite")]);
    setRewrites([...rewrites, { domain: "", answer: "", enabled: true }]);
  };
  const removeRewrite = (index: number) => {
    setRewriteKeys(rewriteKeys.filter((_, itemIndex) => itemIndex !== index));
    setRewrites(rewrites.filter((_, itemIndex) => itemIndex !== index));
  };
  return (
    <div className="card form-stack">
      <div className="section-heading">
        <h2>Rewrite entries</h2>
        <button
          type="button"
          className="button button--secondary"
          onClick={addRewrite}
        >
          Add rewrite
        </button>
      </div>
      <Check
        label="DNS rewrites enabled globally"
        checked={draft.document.shared.rewritesEnabled}
        onChange={(value) =>
          setDraft({
            ...draft,
            document: {
              ...draft.document,
              shared: {
                ...draft.document.shared,
                rewritesEnabled: value,
              },
            },
          })
        }
      />
      {rewrites.map((rewrite, index) => (
        <div className="form-grid repeat-row" key={rewriteKeys[index]}>
          <label>
            Domain
            <input
              value={rewrite.domain}
              onChange={(event) =>
                setRewrites(
                  rewrites.map((item, i) =>
                    i === index
                      ? { ...item, domain: event.target.value }
                      : item,
                  ),
                )
              }
            />
          </label>
          <label>
            Answer
            <input
              value={rewrite.answer}
              onChange={(event) =>
                setRewrites(
                  rewrites.map((item, i) =>
                    i === index
                      ? { ...item, answer: event.target.value }
                      : item,
                  ),
                )
              }
            />
          </label>
          <Check
            label="Rewrite enabled"
            checked={rewrite.enabled}
            onChange={(value) =>
              setRewrites(
                rewrites.map((item, i) =>
                  i === index ? { ...item, enabled: value } : item,
                ),
              )
            }
          />
          <button
            type="button"
            className="button button--danger"
            onClick={() => removeRewrite(index)}
          >
            Remove
          </button>
        </div>
      ))}
      {rewrites.length === 0 && (
        <p className="muted">No rewrites are managed.</p>
      )}
    </div>
  );
}

function ServicesForm({ draft, setDraft }: DraftProps) {
  const services = draft.document.shared.services;
  const update = (patch: Partial<typeof services>) =>
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: {
          ...draft.document.shared,
          services: { ...services, ...patch },
        },
      },
    });
  const safe = services.safeSearch ?? emptySafeSearch();
  return (
    <div className="card form-stack">
      <h2>Global protection services</h2>
      <TextLines
        label="Blocked service identifiers"
        value={services.blockedServiceIds}
        onChange={(value) => update({ blockedServiceIds: value })}
        rows={8}
      />
      <ScheduleEditor
        value={services.blockedSchedule}
        onChange={(value) => update({ blockedSchedule: value })}
        label="Global blocked-services schedule"
      />
      <div className="toggle-grid">
        <Check
          label="Safe Browsing"
          checked={services.safeBrowsing}
          onChange={(value) => update({ safeBrowsing: value })}
        />
        <Check
          label="Parental controls"
          checked={services.parentalControl}
          onChange={(value) => update({ parentalControl: value })}
        />
        <Check
          label="Safe Search"
          checked={safe.enabled}
          onChange={(value) =>
            update({ safeSearch: { ...safe, enabled: value } })
          }
        />
        {(
          [
            "bing",
            "duckDuckGo",
            "ecosia",
            "google",
            "pixabay",
            "yandex",
            "youTube",
          ] as const
        ).map((engine) => (
          <Check
            key={engine}
            label={`Safe Search: ${engine}`}
            checked={safe[engine]}
            onChange={(value) =>
              update({ safeSearch: { ...safe, [engine]: value } })
            }
          />
        ))}
      </div>
    </div>
  );
}

function PrivacyForm({ draft, setDraft }: DraftProps) {
  const shared = draft.document.shared;
  const setQuery = (patch: Partial<typeof shared.queryLog>) =>
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: { ...shared, queryLog: { ...shared.queryLog, ...patch } },
      },
    });
  const setStats = (patch: Partial<typeof shared.statistics>) =>
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: { ...shared, statistics: { ...shared.statistics, ...patch } },
      },
    });
  return (
    <div className="form-stack">
      <div className="notice notice--info">
        These settings control storage inside each AdGuard Home node. Release
        0.4 does not copy query history or statistics into the controller.
      </div>
      <section className="card form-stack">
        <h2>Query log</h2>
        <div className="form-grid">
          <Check
            label="Query log enabled"
            checked={shared.queryLog.enabled}
            onChange={(value) => setQuery({ enabled: value })}
          />
          <DurationDaysField
            label="Retention/rotation interval (days)"
            valueMillis={shared.queryLog.intervalMillis}
            onChange={(value) => setQuery({ intervalMillis: value })}
          />
          <Check
            label="Anonymize client IP"
            checked={shared.queryLog.anonymizeClientIp}
            onChange={(value) => setQuery({ anonymizeClientIp: value })}
          />
          <Check
            label="Apply ignored-host list"
            checked={shared.queryLog.ignoredEnabled}
            onChange={(value) => setQuery({ ignoredEnabled: value })}
          />
          <TextLines
            label="Ignored host names"
            value={shared.queryLog.ignored}
            onChange={(value) => setQuery({ ignored: value })}
          />
          <Check
            label="Apply ignored-host list"
            checked={shared.statistics.ignoredEnabled}
            onChange={(value) => setStats({ ignoredEnabled: value })}
          />
        </div>
      </section>
      <section className="card form-stack">
        <h2>Statistics</h2>
        <div className="form-grid">
          <Check
            label="Statistics enabled"
            checked={shared.statistics.enabled}
            onChange={(value) => setStats({ enabled: value })}
          />
          <DurationDaysField
            label="Retention interval (days)"
            valueMillis={shared.statistics.intervalMillis}
            onChange={(value) => setStats({ intervalMillis: value })}
          />
          <TextLines
            label="Ignored host names"
            value={shared.statistics.ignored}
            onChange={(value) => setStats({ ignored: value })}
          />
        </div>
      </section>
    </div>
  );
}

function InfrastructureForm({
  draft,
  setDraft,
  nodes,
  snapshots,
}: DraftProps & { nodes: Node[]; snapshots: ConfigurationSnapshot[] }) {
  const nodeNames = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.name])),
    [nodes],
  );
  function setDhcp(nodeId: string, dhcp: DhcpConfiguration) {
    const current = draft.document.nodeOverrides[nodeId];
    const overrides = { ...draft.document.nodeOverrides };
    if (dhcp.enabled) {
      for (const [otherNodeId, override] of Object.entries(overrides)) {
        if (otherNodeId !== nodeId && override.dhcp?.enabled) {
          overrides[otherNodeId] = {
            ...override,
            dhcp: { ...override.dhcp, enabled: false },
          };
        }
      }
    }
    overrides[nodeId] = {
      bindHosts: current?.bindHosts ?? [],
      dnsPort: current?.dnsPort ?? 53,
      dhcp,
    };
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        nodeOverrides: overrides,
      },
    });
  }
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
      <section>
        <h2>DHCP: one active node maximum</h2>
        <p className="muted">
          During a role handoff, deployment disables non-active nodes before
          enabling the designated node.
        </p>
        <div className="card-list">
          {nodes
            .filter((node) => node.enabled)
            .map((node) => {
              const current = draft.document.nodeOverrides[node.id];
              const dhcp = current?.dhcp;
              if (!dhcp)
                return (
                  <article className="card dhcp-node-card" key={node.id}>
                    <h3 className="form-card__title">{node.name}</h3>
                    <p className="muted">
                      DHCP is unavailable or has not been observed. Refresh and
                      import this node before managing it.
                    </p>
                  </article>
                );
              const update = (patch: Partial<DhcpConfiguration>) =>
                setDhcp(node.id, { ...dhcp, ...patch });
              return (
                <fieldset className="card dhcp-node-card" key={node.id}>
                  <legend className="visually-hidden">
                    {node.name} DHCP settings
                  </legend>
                  <h3 className="form-card__title">{node.name}</h3>
                  <div className="form-grid">
                    <Check
                      label="Designated active DHCP node"
                      checked={dhcp.enabled}
                      onChange={(value) => update({ enabled: value })}
                    />
                    <label>
                      Interface
                      <input
                        value={dhcp.interfaceName}
                        onChange={(event) =>
                          update({ interfaceName: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      IPv4 gateway
                      <input
                        value={dhcp.ipv4.gateway}
                        onChange={(event) =>
                          update({
                            ipv4: { ...dhcp.ipv4, gateway: event.target.value },
                          })
                        }
                      />
                    </label>
                    <label>
                      Subnet mask
                      <input
                        value={dhcp.ipv4.subnetMask}
                        onChange={(event) =>
                          update({
                            ipv4: {
                              ...dhcp.ipv4,
                              subnetMask: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Range start
                      <input
                        value={dhcp.ipv4.rangeStart}
                        onChange={(event) =>
                          update({
                            ipv4: {
                              ...dhcp.ipv4,
                              rangeStart: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Range end
                      <input
                        value={dhcp.ipv4.rangeEnd}
                        onChange={(event) =>
                          update({
                            ipv4: {
                              ...dhcp.ipv4,
                              rangeEnd: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <NumberField
                      label="Lease duration (seconds)"
                      value={dhcp.ipv4.leaseDurationSeconds}
                      onChange={(value) =>
                        update({
                          ipv4: { ...dhcp.ipv4, leaseDurationSeconds: value },
                        })
                      }
                    />
                    <label>
                      IPv6 range start
                      <input
                        value={dhcp.ipv6.rangeStart}
                        onChange={(event) =>
                          update({
                            ipv6: {
                              ...dhcp.ipv6,
                              rangeStart: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <NumberField
                      label="IPv6 lease duration (seconds)"
                      value={dhcp.ipv6.leaseDurationSeconds}
                      onChange={(value) =>
                        update({
                          ipv6: { ...dhcp.ipv6, leaseDurationSeconds: value },
                        })
                      }
                    />
                  </div>
                  <StaticLeasesEditor
                    value={dhcp.staticLeases}
                    onChange={(value) => update({ staticLeases: value })}
                  />
                </fieldset>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function StaticLeasesEditor({
  value,
  onChange,
}: {
  value: DhcpStaticLease[];
  onChange: (value: DhcpStaticLease[]) => void;
}) {
  const [leaseKeys, setLeaseKeys] = useState(() =>
    value.map(() => createEditorRowKey("lease")),
  );
  const update = (index: number, patch: Partial<DhcpStaticLease>) =>
    onChange(
      value.map((lease, leaseIndex) =>
        leaseIndex === index ? { ...lease, ...patch } : lease,
      ),
    );
  return (
    <div className="form-stack">
      <div className="section-heading">
        <h3>Static leases</h3>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            setLeaseKeys([...leaseKeys, createEditorRowKey("lease")]);
            onChange([...value, { mac: "", ip: "", hostname: "" }]);
          }}
        >
          Add static lease
        </button>
      </div>
      {value.length === 0 && <p className="muted">No static leases.</p>}
      {value.map((lease, index) => (
        <div className="form-grid repeat-row" key={leaseKeys[index]}>
          <label>
            MAC address
            <input
              value={lease.mac}
              onChange={(event) => update(index, { mac: event.target.value })}
            />
          </label>
          <label>
            IP address
            <input
              value={lease.ip}
              onChange={(event) => update(index, { ip: event.target.value })}
            />
          </label>
          <label>
            Hostname
            <input
              value={lease.hostname}
              onChange={(event) =>
                update(index, { hostname: event.target.value })
              }
            />
          </label>
          <button
            type="button"
            className="button button--danger"
            onClick={() => {
              setLeaseKeys(
                leaseKeys.filter((_, leaseIndex) => leaseIndex !== index),
              );
              onChange(value.filter((_, leaseIndex) => leaseIndex !== index));
            }}
          >
            Remove lease
          </button>
        </div>
      ))}
    </div>
  );
}

const scheduleDays = [
  ["sun", "Sunday"],
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
] as const;

function ScheduleEditor({
  value,
  onChange,
  label,
}: {
  value: Schedule;
  onChange: (value: Schedule) => void;
  label: string;
}) {
  const schedule = value ?? { timeZone: "Local", days: {} };
  const updateDay = (day: string, enabled: boolean) => {
    const days = { ...schedule.days };
    if (enabled) days[day] = days[day] ?? { start: 0, end: 86_400_000 };
    else delete days[day];
    onChange({ ...schedule, days });
  };
  return (
    <fieldset className="schedule-editor">
      <legend className="visually-hidden">{label}</legend>
      <h3 className="schedule-editor__title">{label}</h3>
      <label>
        IANA time zone (or Local)
        <input
          value={schedule.timeZone || "Local"}
          onChange={(event) =>
            onChange({ ...schedule, timeZone: event.target.value })
          }
        />
      </label>
      <div className="schedule-grid">
        {scheduleDays.map(([day, dayLabel]) => {
          const range = schedule.days[day];
          return (
            <div className="schedule-row" key={day}>
              <Check
                label={dayLabel}
                checked={Boolean(range)}
                onChange={(enabled) => updateDay(day, enabled)}
              />
              <input
                aria-label={`${dayLabel} start`}
                type="time"
                step={60}
                disabled={!range}
                value={range ? formatTimeOfDay(range.start) : "00:00"}
                onChange={(event) =>
                  onChange({
                    ...schedule,
                    days: {
                      ...schedule.days,
                      [day]: {
                        ...(range ?? { end: 86_400_000 }),
                        start: parseTimeOfDay(event.target.value),
                      },
                    },
                  })
                }
              />
              <input
                aria-label={`${dayLabel} end`}
                type="time"
                step={60}
                disabled={!range}
                value={
                  range?.end === 86_400_000
                    ? "23:59"
                    : formatTimeOfDay(range?.end ?? 86_400_000)
                }
                onChange={(event) =>
                  onChange({
                    ...schedule,
                    days: {
                      ...schedule.days,
                      [day]: {
                        ...(range ?? { start: 0 }),
                        end: parseTimeOfDay(event.target.value),
                      },
                    },
                  })
                }
              />
            </div>
          );
        })}
      </div>
      <p className="muted">
        A selected day is the period when blocked-service filtering is inactive.
      </p>
    </fieldset>
  );
}

function DurationDaysField({
  label,
  valueMillis,
  onChange,
}: {
  label: string;
  valueMillis: number;
  onChange: (valueMillis: number) => void;
}) {
  return (
    <NumberField
      label={label}
      value={valueMillis / 86_400_000}
      step={0.25}
      onChange={(days) => onChange(Math.round(days * 86_400_000))}
    />
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
