import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { PartialSuccessPanel } from "../../components/DataDisplay";
import {
  Banner,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/Feedback";
import { OperationalCommandDialog } from "../../components/Overlays";
import { PageContainer, PageHeader } from "../../components/Page";
import {
  CapabilityWarning,
  Field,
  ScopeIndicator,
  SettingRow,
  SettingsGroup,
  UnsavedChangesNotice,
} from "../../components/Settings";
import { StatusBadge } from "../../components/StatusBadge";
import {
  DurationField,
  NetworkListField,
  UpstreamEditor,
  validateNetwork,
} from "../../components/StructuredInputs";
import { api } from "../../lib/api";
import { newIdempotencyKey } from "../../lib/idempotency";
import type {
  CapabilityProfile,
  Cluster,
  ConfigurationDraft,
  ConfigurationRevision,
  DNSOperationalCommand,
  Node,
  OperationalTarget,
  ValidationIssue,
} from "../../lib/types";
import {
  type CacheSizeUnit,
  cacheSizeForDisplay,
  cacheSizeToBytes,
  DNS_DURATION_UNITS,
  TIMEOUT_PRESETS,
  TTL_PRESETS,
  validateIp,
  validateIpFamily,
  validCacheSize,
  validWholeSeconds,
} from "./model";

const BLOCKING_MODES = [
  ["default", "Default"],
  ["refused", "REFUSED"],
  ["nxdomain", "NXDOMAIN"],
  ["null_ip", "Null IP"],
  ["custom_ip", "Custom IP"],
] as const;

const UPSTREAM_MODES = [
  ["load_balance", "Load balancing"],
  ["parallel", "Parallel requests"],
  ["fastest_addr", "Fastest IP address"],
] as const;

const knownValue = (
  value: string,
  options: readonly (readonly [string, string])[],
) => options.some(([option]) => option === value);

export function DNSSettingsPage({ cluster }: { cluster: Cluster }) {
  const [draft, setDraft] = useState<ConfigurationDraft>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [revisions, setRevisions] = useState<ConfigurationRevision[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityProfile[]>([]);
  const [savedDocument, setSavedDocument] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();
  const [command, setCommand] = useState<"test" | "cache" | "">("");
  const [commandScope, setCommandScope] = useState<
    "node" | "all_compatible_enabled_nodes"
  >("node");
  const [commandNodeID, setCommandNodeID] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandResult, setCommandResult] = useState<DNSOperationalCommand>();
  const [commandUpstreams, setCommandUpstreams] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inventory, nodeResult, revisionResult] = await Promise.all([
        api.configurationInventory(cluster.id),
        api.nodes(cluster.id),
        api.configurationRevisions(cluster.id),
      ]);
      setDraft(inventory.draft);
      setSavedDocument(
        inventory.draft ? JSON.stringify(inventory.draft.document) : "",
      );
      setNodes(nodeResult.items);
      setRevisions(revisionResult.items);
      setCapabilities(inventory.capabilities);
      setIssues([]);
      setSaved(false);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [cluster.id]);

  useEffect(() => void load(), [load]);

  useEffect(() => {
    let cancelled = false;
    const stored = window.sessionStorage.getItem(
      `aghha-dns-operation:${cluster.id}`,
    );
    if (stored === null) return;
    try {
      const value = JSON.parse(stored) as { id?: string; upstreams?: string[] };
      if (typeof value.id !== "string") return;
      setCommandUpstreams(
        Array.isArray(value.upstreams) ? value.upstreams.slice(0, 64) : [],
      );
      void (async () => {
        try {
          let result = await api.dnsOperation(value.id as string);
          while (
            !cancelled &&
            (result.status === "queued" || result.status === "running")
          ) {
            setCommandResult(result);
            await new Promise((resolve) => window.setTimeout(resolve, 500));
            result = await api.dnsOperation(value.id as string);
          }
          if (!cancelled) {
            if (
              result.command === "test_upstream_dns" &&
              result.status === "succeeded"
            ) {
              window.sessionStorage.removeItem(
                `aghha-dns-operation:${cluster.id}`,
              );
            } else {
              setCommandResult(result);
            }
          }
        } catch {
          window.sessionStorage.removeItem(`aghha-dns-operation:${cluster.id}`);
        }
      })();
    } catch {
      window.sessionStorage.removeItem(`aghha-dns-operation:${cluster.id}`);
    }
    return () => {
      cancelled = true;
    };
  }, [cluster.id]);

  const affectedNodes = nodes.filter((node) => node.enabled);
  const activeRevision = revisions.find(
    (revision) => revision.active || revision.id === cluster.activeRevisionId,
  );
  const dirty =
    draft !== undefined && JSON.stringify(draft.document) !== savedDocument;
  const nodeNames = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.name])),
    [nodes],
  );
  const affectedCapabilities = capabilities.filter((profile) =>
    affectedNodes.some((node) => node.id === profile.nodeId),
  );
  const missingProfileNodes = affectedNodes.filter(
    (node) =>
      !affectedCapabilities.some((profile) => profile.nodeId === node.id),
  );
  const missingFeature = (feature: string) =>
    affectedCapabilities.filter((profile) => !profile.features[feature]);
  const eligibleCommandNodes = affectedNodes.filter((node) => {
    const profile = capabilities.find((item) => item.nodeId === node.id);
    if (node.maintenanceMode || profile?.compatibility !== "supported")
      return false;
    const feature = command === "cache" ? "cache_clear" : "test_upstream_dns";
    return profile.features[feature] === true;
  });

  if (loading && draft === undefined) {
    return (
      <PageContainer size="full">
        <PageHeader title="DNS settings" />
        <LoadingSkeleton label="Loading DNS Settings" rows={9} />
      </PageContainer>
    );
  }
  if (error !== undefined && draft === undefined) {
    return (
      <PageContainer size="full">
        <PageHeader title="DNS settings" />
        <ErrorState error={error} retry={() => void load()} />
      </PageContainer>
    );
  }

  const dns = draft?.document.shared.dns;
  const invalid = dns === undefined ? false : invalidDNSPresentation(dns);

  async function saveDraft() {
    if (draft === undefined || invalid) return;
    setSaving(true);
    setSaved(false);
    try {
      const result = await api.updateConfigurationDraft(
        cluster.id,
        draft.version,
        draft.document,
      );
      setDraft(result.draft);
      setSavedDocument(JSON.stringify(result.draft.document));
      setIssues(result.issues);
      setSaved(true);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  function updateDNS(patch: Partial<NonNullable<typeof dns>>) {
    if (draft === undefined || dns === undefined) return;
    setSaved(false);
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: {
          ...draft.document.shared,
          dns: { ...dns, ...patch },
        },
      },
    });
  }

  function openCommand(next: "test" | "cache") {
    const feature = next === "cache" ? "cache_clear" : "test_upstream_dns";
    const eligible = affectedNodes.filter((node) => {
      const profile = capabilities.find((item) => item.nodeId === node.id);
      return (
        !node.maintenanceMode &&
        profile?.compatibility === "supported" &&
        profile.features[feature] === true
      );
    });
    setCommandNodeID(eligible[0]?.id ?? "");
    setCommandScope("node");
    setCommand(next);
  }

  async function runCommand() {
    if (draft === undefined || dns === undefined) return;
    const target: OperationalTarget =
      commandScope === "node"
        ? { scope: "node", nodeId: commandNodeID }
        : { scope: "all_compatible_enabled_nodes" };
    const submittedUpstreams =
      command === "test" ? [...(dns.upstreamDns ?? [])] : [];
    setCommandBusy(true);
    setCommandResult(undefined);
    setCommandUpstreams(submittedUpstreams);
    try {
      const idempotencyKey = newIdempotencyKey();
      let result =
        command === "test"
          ? await api.testUpstreamDNS(
              cluster.id,
              target,
              {
                draftVersion: draft.version,
                upstreamDns: dns.upstreamDns ?? [],
                bootstrapDns: dns.bootstrapDns ?? [],
                fallbackDns: dns.fallbackDns ?? [],
                privateReverseDns: dns.privateReverseDns ?? [],
                upstreamMode: dns.upstreamMode || "load_balance",
                usePrivateReverseResolvers:
                  dns.usePrivateReverseResolvers ?? false,
              },
              idempotencyKey,
            )
          : await api.clearDNSCache(cluster.id, target, idempotencyKey);
      setCommand("");
      setCommandResult(result);
      window.sessionStorage.setItem(
        `aghha-dns-operation:${cluster.id}`,
        JSON.stringify({ id: result.id, upstreams: submittedUpstreams }),
      );
      while (result.status === "queued" || result.status === "running") {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        result = await api.dnsOperation(result.id);
        setCommandResult(result);
      }
      if (command === "test" && result.status === "succeeded") {
        window.sessionStorage.removeItem(`aghha-dns-operation:${cluster.id}`);
      }
      if (
        command === "cache" &&
        result.nodeResults.some((item) => item.status === "succeeded")
      ) {
        await load();
      }
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setCommandBusy(false);
    }
  }

  function dismissCommandResult() {
    setCommandResult(undefined);
    setCommandUpstreams([]);
    window.sessionStorage.removeItem(`aghha-dns-operation:${cluster.id}`);
  }

  const cacheToggleMissing = missingFeature("cache_toggle");
  const timeoutMissing = missingFeature("upstream_timeout");
  const dnsMissing = missingFeature("dns");
  const dnsUnsupported =
    draft?.document.unsupported.filter((entry) =>
      entry.section.toLocaleLowerCase().includes("dns"),
    ) ?? [];

  return (
    <PageContainer size="full" className="dns-settings-page">
      <PageHeader
        eyebrow="Settings"
        title="DNS settings"
        description="Manage shared upstream, resolver, rate-limit, blocking, DNS feature, and cache desired state."
        focusOnMount
        primaryAction={
          <button
            type="button"
            className="button"
            disabled={draft === undefined || saving || !dirty || invalid}
            onClick={() => void saveDraft()}
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>
        }
      />

      {error !== undefined && (
        <Banner tone="danger" title="The latest request failed">
          {error instanceof Error ? error.message : String(error)}
        </Banner>
      )}

      {draft === undefined ? (
        <EmptyState title="Import a node configuration first">
          <p>
            Open Configuration Control, refresh a node, and import its
            observation to create the cluster draft.
          </p>
        </EmptyState>
      ) : draft.document.schemaVersion !== 2 || dns === undefined ? (
        <Banner tone="danger" title="Unsupported draft format">
          Import a current schema-v2 observation before editing DNS Settings.
        </Banner>
      ) : (
        <>
          <UnsavedChangesNotice dirty={dirty} saving={saving} saved={saved} />

          <SettingsGroup title="Draft and scope">
            <dl className="general-settings-state">
              <div>
                <dt>Scope</dt>
                <dd>
                  <ScopeIndicator scope="cluster" />
                </dd>
              </div>
              <div>
                <dt>Draft status</dt>
                <dd>
                  {dirty ? "Unsaved changes" : `Version ${draft.version}`}
                </dd>
              </div>
              <div>
                <dt>Active revision</dt>
                <dd>
                  {activeRevision
                    ? `Revision #${activeRevision.revisionNumber}`
                    : "None"}
                </dd>
              </div>
              <div>
                <dt>Affected nodes</dt>
                <dd>{affectedNodes.length}</dd>
              </div>
            </dl>
          </SettingsGroup>

          <Banner tone="info" title="Revisioned desired state">
            Save Draft does not change any node. Publish an immutable revision
            in Configuration Control, then deploy and verify it separately.
          </Banner>

          {commandResult !== undefined && (
            <CommandResultPanel
              operation={commandResult}
              upstreams={commandUpstreams}
              onDismiss={dismissCommandResult}
            />
          )}

          {(missingProfileNodes.length > 0 || dnsMissing.length > 0) && (
            <CapabilityWarning
              state="partial"
              title="DNS capability data is incomplete"
            >
              Refresh or resolve compatibility for:{" "}
              {[
                ...missingProfileNodes.map((node) => node.name),
                ...dnsMissing.map((profile) =>
                  nodeName(profile.nodeId, nodeNames),
                ),
              ].join(", ")}
              . Existing desired values are preserved.
            </CapabilityWarning>
          )}
          {dnsUnsupported.length > 0 && (
            <CapabilityWarning
              state="unsupported"
              title="Imported DNS data includes unsupported areas"
            >
              <ul className="compact-list">
                {dnsUnsupported.map((entry) => (
                  <li key={`${entry.section}-${entry.reason}`}>
                    {entry.section}: {entry.reason}
                  </li>
                ))}
              </ul>
            </CapabilityWarning>
          )}

          <SettingsGroup
            title="Upstream DNS"
            description="Primary resolvers and request strategy. Specialist AdGuard expressions remain ordered and opaque."
            actions={
              <button
                type="button"
                className="button button--secondary"
                disabled={
                  (dns.upstreamDns ?? []).length === 0 ||
                  !affectedCapabilities.some(
                    (profile) => profile.features.test_upstream_dns,
                  )
                }
                onClick={() => openCommand("test")}
              >
                Test upstreams
              </button>
            }
          >
            <div className="dns-editor-block">
              <UpstreamEditor
                label="Primary upstreams"
                value={dns.upstreamDns ?? []}
                onChange={(upstreamDns) => updateDNS({ upstreamDns })}
                rows={8}
                placeholder="https://dns.example/dns-query"
                help={<UpstreamSyntaxHelp />}
              />
            </div>
            <SettingRow
              title="Upstream strategy"
              description="Choose how each node selects from the ordered primary upstream list."
              control={
                <EnumSelect
                  label="Upstream strategy"
                  value={dns.upstreamMode ?? ""}
                  options={UPSTREAM_MODES}
                  onChange={(upstreamMode) => updateDNS({ upstreamMode })}
                />
              }
            />
          </SettingsGroup>

          <SettingsGroup
            title="Bootstrap and fallback"
            description="Bootstrap resolvers locate encrypted upstream hosts; fallback resolvers are tried when primary resolution is unavailable. Values are not rewritten in the browser."
          >
            <div className="dns-editor-block">
              <UpstreamEditor
                label="Bootstrap resolvers"
                value={dns.bootstrapDns ?? []}
                onChange={(bootstrapDns) => updateDNS({ bootstrapDns })}
                rows={5}
                placeholder="9.9.9.9"
                help="One bootstrap resolver per line. The editor preserves entered order and exact text; schema-v2 canonicalisation treats this collection as a set."
              />
            </div>
            <div className="dns-editor-block">
              <UpstreamEditor
                label="Fallback resolvers"
                value={dns.fallbackDns ?? []}
                onChange={(fallbackDns) => updateDNS({ fallbackDns })}
                rows={5}
                placeholder="1.1.1.1"
                help="One fallback resolver per line. Fallback order is semantic and is preserved through revision, deployment, and read-back."
              />
            </div>
          </SettingsGroup>

          <SettingsGroup
            title="Private reverse DNS"
            description="Control client-name lookups and the resolvers used for private reverse zones."
          >
            <SettingRow
              title="Use private reverse resolvers"
              description="Send private reverse lookups to the desired resolver list."
              control={
                <Toggle
                  label="Use private reverse resolvers"
                  checked={dns.usePrivateReverseResolvers ?? false}
                  onChange={(usePrivateReverseResolvers) =>
                    updateDNS({ usePrivateReverseResolvers })
                  }
                />
              }
            />
            <SettingRow
              title="Reverse-resolve clients"
              description="Resolve client names through reverse DNS on each managed node."
              control={
                <Toggle
                  label="Reverse-resolve clients"
                  checked={dns.resolveClients ?? false}
                  onChange={(resolveClients) => updateDNS({ resolveClients })}
                />
              }
            />
            <div className="dns-editor-block">
              <UpstreamEditor
                label="Private reverse resolvers"
                value={dns.privateReverseDns ?? []}
                onChange={(privateReverseDns) =>
                  updateDNS({ privateReverseDns })
                }
                rows={5}
                placeholder="192.0.2.53"
                help="One resolver per line. Values are retained when private reverse resolution is switched off."
              />
            </div>
          </SettingsGroup>

          <SettingsGroup
            title="Rate limiting"
            description="Limit requests per client network while exempting trusted addresses and prefixes."
          >
            <SettingRow
              title="Rate limit"
              description="Requests per second per client network. Use 0 to disable rate limiting."
              control={
                <NumberInput
                  label="Rate limit"
                  value={dns.rateLimit ?? 0}
                  min={0}
                  error={
                    !Number.isSafeInteger(dns.rateLimit ?? 0) ||
                    (dns.rateLimit ?? 0) < 0
                      ? "Enter a whole number of 0 or greater."
                      : undefined
                  }
                  onChange={(rateLimit) => updateDNS({ rateLimit })}
                />
              }
            />
            <SettingRow
              title="IPv4 subnet length"
              description="Group IPv4 clients by prefix length (range 0–32)."
              control={
                <NumberInput
                  label="IPv4 subnet length (0 to 32)"
                  value={dns.rateLimitSubnetLengthIpv4 ?? 0}
                  min={0}
                  max={32}
                  error={
                    !integerInRange(dns.rateLimitSubnetLengthIpv4 ?? 0, 0, 32)
                      ? "Enter a whole number from 0 to 32."
                      : undefined
                  }
                  onChange={(rateLimitSubnetLengthIpv4) =>
                    updateDNS({ rateLimitSubnetLengthIpv4 })
                  }
                />
              }
            />
            <SettingRow
              title="IPv6 subnet length"
              description="Group IPv6 clients by prefix length (range 0–128)."
              control={
                <NumberInput
                  label="IPv6 subnet length (0 to 128)"
                  value={dns.rateLimitSubnetLengthIpv6 ?? 0}
                  min={0}
                  max={128}
                  error={
                    !integerInRange(dns.rateLimitSubnetLengthIpv6 ?? 0, 0, 128)
                      ? "Enter a whole number from 0 to 128."
                      : undefined
                  }
                  onChange={(rateLimitSubnetLengthIpv6) =>
                    updateDNS({ rateLimitSubnetLengthIpv6 })
                  }
                />
              }
            />
            <div className="dns-list-block">
              <NetworkListField
                label="Rate-limit allowlist"
                value={dns.rateLimitAllowlist ?? []}
                onChange={(rateLimitAllowlist) =>
                  updateDNS({ rateLimitAllowlist })
                }
                placeholder="192.0.2.0/24"
                addLabel="Add network"
                emptyMessage="No clients bypass rate limiting."
                help="Add an IPv4 or IPv6 address or CIDR prefix. Invalid rows remain visible and block saving."
              />
            </div>
          </SettingsGroup>

          <SettingsGroup
            title="Blocking"
            description="Choose the DNS response returned for blocked requests."
          >
            <SettingRow
              title="Blocking mode"
              control={
                <EnumSelect
                  label="Blocking mode"
                  value={dns.blockingMode ?? ""}
                  options={BLOCKING_MODES}
                  onChange={(blockingMode) => updateDNS({ blockingMode })}
                />
              }
            />
            {dns.blockingMode === "custom_ip" && (
              <>
                <SettingRow
                  title="Custom blocking IPv4"
                  description="IPv4 answer returned for blocked A queries."
                  control={
                    <TextInput
                      label="Custom blocking IPv4"
                      value={dns.blockingIpv4 ?? ""}
                      error={validateIpFamily(dns.blockingIpv4 ?? "", 4)}
                      onChange={(blockingIpv4) => updateDNS({ blockingIpv4 })}
                    />
                  }
                />
                <SettingRow
                  title="Custom blocking IPv6"
                  description="IPv6 answer returned for blocked AAAA queries."
                  control={
                    <TextInput
                      label="Custom blocking IPv6"
                      value={dns.blockingIpv6 ?? ""}
                      error={validateIpFamily(dns.blockingIpv6 ?? "", 6)}
                      onChange={(blockingIpv6) => updateDNS({ blockingIpv6 })}
                    />
                  }
                />
              </>
            )}
            <SettingRow
              title="Blocked response TTL"
              description="How long clients may cache a blocked response; 0 keeps the node default."
              control={
                <DurationField
                  label="Blocked response TTL"
                  value={dns.blockedResponseTtl ?? 0}
                  unit="seconds"
                  presets={TTL_PRESETS}
                  customUnits={DNS_DURATION_UNITS}
                  min={0}
                  integer
                  invalidMessage="Enter an exact non-negative whole number of seconds."
                  onChange={(blockedResponseTtl) =>
                    updateDNS({ blockedResponseTtl })
                  }
                />
              }
            />
          </SettingsGroup>

          <SettingsGroup
            title="DNS features"
            description="Validation and client-subnet behavior shared by all affected nodes."
          >
            <SettingRow
              title="DNSSEC"
              description="Validate DNSSEC signatures in upstream responses."
              control={
                <Toggle
                  label="DNSSEC"
                  checked={dns.dnssecEnabled ?? false}
                  onChange={(dnssecEnabled) => updateDNS({ dnssecEnabled })}
                />
              }
            />
            <SettingRow
              title="EDNS Client Subnet"
              description="Include client subnet information in supported upstream requests."
              control={
                <Toggle
                  label="EDNS Client Subnet"
                  checked={dns.ednsClientSubnet ?? false}
                  onChange={(ednsClientSubnet) =>
                    updateDNS({ ednsClientSubnet })
                  }
                />
              }
            />
            {dns.ednsClientSubnet && (
              <SettingRow
                title="Use a custom ECS address"
                description="Use one fixed address instead of deriving the subnet from each client."
                control={
                  <Toggle
                    label="Use a custom ECS address"
                    checked={dns.ednsUseCustom ?? false}
                    onChange={(ednsUseCustom) => updateDNS({ ednsUseCustom })}
                  />
                }
              />
            )}
            {dns.ednsClientSubnet && dns.ednsUseCustom && (
              <SettingRow
                title="Custom ECS address"
                control={
                  <TextInput
                    label="Custom ECS address"
                    value={dns.ednsCustomIp ?? ""}
                    error={
                      dns.ednsCustomIp?.trim()
                        ? validateIp(dns.ednsCustomIp)
                        : "Enter an IPv4 or IPv6 address."
                    }
                    onChange={(ednsCustomIp) => updateDNS({ ednsCustomIp })}
                  />
                }
              />
            )}
            <SettingRow
              title="Disable IPv6 answers"
              description="Suppress IPv6 AAAA answers. This does not disable IPv6 networking or resolver transport."
              control={
                <Toggle
                  label="Disable IPv6 answers"
                  checked={dns.disableIpv6 ?? false}
                  onChange={(disableIpv6) => updateDNS({ disableIpv6 })}
                />
              }
            />
          </SettingsGroup>

          {cacheToggleMissing.length > 0 && (
            <CapabilityWarning
              state="partial"
              title="Cache enablement differs by version"
            >
              A separate cache switch is unavailable on{" "}
              {nodeList(cacheToggleMissing, nodeNames)}. The imported value is
              preserved and existing publication fallback rules still apply.
            </CapabilityWarning>
          )}
          {timeoutMissing.length > 0 && (
            <CapabilityWarning
              state="partial"
              title="Upstream timeout differs by version"
            >
              A configurable upstream timeout is unavailable on{" "}
              {nodeList(timeoutMissing, nodeNames)}. Keep 0 for the node default
              when targeting those nodes; imported values are not coerced.
            </CapabilityWarning>
          )}

          <SettingsGroup
            title="Cache"
            description="Control each node's DNS response cache using human-readable units backed by exact schema values."
            actions={
              <button
                type="button"
                className="button button--danger"
                disabled={
                  !affectedCapabilities.some(
                    (profile) => profile.features.cache_clear,
                  )
                }
                onClick={() => openCommand("cache")}
              >
                Clear DNS cache
              </button>
            }
          >
            <SettingRow
              title="Cache enabled"
              description="Retain imported enablement when older nodes do not expose a separate cache toggle."
              control={
                <Toggle
                  label="Cache enabled"
                  checked={dns.cacheEnabled ?? false}
                  disabled={cacheToggleMissing.length > 0}
                  status={
                    cacheToggleMissing.length > 0
                      ? "Unavailable on some nodes"
                      : undefined
                  }
                  onChange={(cacheEnabled) => updateDNS({ cacheEnabled })}
                />
              }
            />
            <SettingRow
              title="Cache size"
              description="Stored as exact bytes; binary KiB and MiB are presentation units only."
              control={
                <CacheSizeField
                  value={dns.cacheSize ?? 0}
                  enabled={dns.cacheEnabled ?? false}
                  onChange={(cacheSize) => updateDNS({ cacheSize })}
                />
              }
            />
            <SettingRow
              title="Minimum TTL override"
              description="Use 0 for no minimum override."
              control={
                <DurationField
                  label="Minimum cache TTL"
                  value={dns.cacheTtlMin ?? 0}
                  unit="seconds"
                  presets={TTL_PRESETS}
                  customUnits={DNS_DURATION_UNITS}
                  min={0}
                  integer
                  invalidMessage="Enter an exact non-negative whole number of seconds."
                  onChange={(cacheTtlMin) => updateDNS({ cacheTtlMin })}
                />
              }
            />
            <SettingRow
              title="Maximum TTL override"
              description="Use 0 for no maximum override. A non-zero maximum cannot be below the minimum."
              control={
                <DurationField
                  label="Maximum cache TTL"
                  value={dns.cacheTtlMax ?? 0}
                  unit="seconds"
                  presets={TTL_PRESETS}
                  customUnits={DNS_DURATION_UNITS}
                  min={0}
                  integer
                  error={
                    (dns.cacheTtlMax ?? 0) > 0 &&
                    (dns.cacheTtlMin ?? 0) > (dns.cacheTtlMax ?? 0)
                      ? "Maximum TTL cannot be below minimum TTL."
                      : undefined
                  }
                  invalidMessage="Enter an exact non-negative whole number of seconds."
                  onChange={(cacheTtlMax) => updateDNS({ cacheTtlMax })}
                />
              }
            />
            <SettingRow
              title="Optimistic cache"
              description="Serve cached responses optimistically while the node refreshes them."
              control={
                <Toggle
                  label="Optimistic cache"
                  checked={dns.cacheOptimistic ?? false}
                  onChange={(cacheOptimistic) => updateDNS({ cacheOptimistic })}
                />
              }
            />
            <SettingRow
              title="Upstream timeout"
              description="Use 0 to retain the node default."
              control={
                <DurationField
                  label="Upstream timeout"
                  value={dns.upstreamTimeoutSeconds ?? 0}
                  unit="seconds"
                  presets={TIMEOUT_PRESETS}
                  customUnits={DNS_DURATION_UNITS}
                  min={0}
                  integer
                  invalidMessage="Enter an exact non-negative whole number of seconds."
                  onChange={(upstreamTimeoutSeconds) =>
                    updateDNS({ upstreamTimeoutSeconds })
                  }
                />
              }
            />
          </SettingsGroup>

          {invalid && (
            <Banner tone="danger" title="Fix inline validation errors">
              Network, address, range, cache-size, TTL, and timeout values must
              be valid before saving the draft.
            </Banner>
          )}
          {issues.length > 0 && (
            <Banner tone="warning" title="Draft validation needs attention">
              <ul className="compact-list">
                {issues.map((issue) => (
                  <li key={`${issue.field}-${issue.message}`}>
                    {issue.field}: {issue.message}
                  </li>
                ))}
              </ul>
            </Banner>
          )}
          <OperationalCommandDialog
            open={command !== ""}
            onClose={() => !commandBusy && setCommand("")}
            onConfirm={() => void runCommand()}
            command={command === "cache" ? "Clear DNS cache" : "Test upstreams"}
            cluster={cluster.name}
            target={
              commandScope === "node"
                ? (eligibleCommandNodes.find(
                    (node) => node.id === commandNodeID,
                  )?.name ?? "Select a node")
                : undefined
            }
            scope={
              commandScope === "node"
                ? "Selected node"
                : `All compatible enabled nodes (${eligibleCommandNodes.length})`
            }
            consequence={
              command === "cache"
                ? "Cached DNS responses are removed. New queries resolve upstream until the cache warms again."
                : "The current draft resolver values are tested without saving or applying them."
            }
            recoverable={
              command === "cache"
                ? "The cache repopulates from subsequent DNS traffic."
                : "No node configuration is changed."
            }
            impact={
              command === "cache"
                ? "DNS desired state, the draft, and active revision remain unchanged."
                : "Resolver values may contain sensitive details and are encrypted while the command is queued."
            }
            busy={commandBusy}
            destructive={command === "cache"}
          >
            <div className="dns-command-targets">
              <label>
                Target scope
                <select
                  value={commandScope}
                  disabled={commandBusy}
                  onChange={(event) =>
                    setCommandScope(event.target.value as typeof commandScope)
                  }
                >
                  <option value="node">Selected node</option>
                  <option value="all_compatible_enabled_nodes">
                    All compatible enabled nodes
                  </option>
                </select>
              </label>
              {commandScope === "node" && (
                <label>
                  Node
                  <select
                    value={commandNodeID}
                    disabled={commandBusy}
                    onChange={(event) => setCommandNodeID(event.target.value)}
                  >
                    {eligibleCommandNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </OperationalCommandDialog>
        </>
      )}
    </PageContainer>
  );
}

function CommandResultPanel({
  operation,
  upstreams,
  onDismiss,
}: {
  operation: DNSOperationalCommand;
  upstreams: string[];
  onDismiss: () => void;
}) {
  const pending =
    operation.status === "queued" || operation.status === "running";
  const results = operation.nodeResults.map((node) => ({
    id: node.id,
    label: node.nodeName,
    status:
      node.status === "succeeded"
        ? ("success" as const)
        : node.status === "failed"
          ? ("failed" as const)
          : ("pending" as const),
    message: node.errorCode || undefined,
  }));
  return (
    <>
      {operation.status === "partial_success" && (
        <PartialSuccessPanel
          title="DNS command partially completed"
          results={results}
        />
      )}
      <section className="dns-command-result" aria-live="polite">
        <header>
          <StatusBadge
            status={
              pending
                ? "pending"
                : operation.status === "succeeded"
                  ? "success"
                  : operation.status === "partial_success"
                    ? "warning"
                    : "failed"
            }
          />
          <h2>
            {operation.command === "test_upstream_dns"
              ? "Upstream test result"
              : "DNS cache clear result"}
          </h2>
          {!pending && (
            <button
              type="button"
              className="button button--secondary dns-command-result__dismiss"
              onClick={onDismiss}
            >
              Dismiss result
            </button>
          )}
        </header>
        <ul className="compact-list">
          {operation.nodeResults.map((node) => (
            <li key={node.id}>
              <strong>{node.nodeName}</strong>: {node.status}
              {node.errorCode ? ` (${node.errorCode})` : ""}
              {node.upstreamResults && node.upstreamResults.length > 0 && (
                <ul>
                  {node.upstreamResults.map((resolver) => {
                    const index =
                      Number(resolver.resolverId.split("-").at(-1)) - 1;
                    return (
                      <li key={resolver.resolverId}>
                        {upstreams[index] ?? resolver.resolverId}:{" "}
                        {resolver.status}
                        {resolver.errorCode ? ` (${resolver.errorCode})` : ""}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {operation.excludedNodes.length > 0 && (
          <p className="muted">
            Excluded:{" "}
            {operation.excludedNodes.map((node) => node.nodeName).join(", ")}.
          </p>
        )}
      </section>
    </>
  );
}

function invalidDNSPresentation(
  dns: ConfigurationDraft["document"]["shared"]["dns"],
): boolean {
  return (
    !Number.isSafeInteger(dns.rateLimit ?? 0) ||
    (dns.rateLimit ?? 0) < 0 ||
    !integerInRange(dns.rateLimitSubnetLengthIpv4 ?? 0, 0, 32) ||
    !integerInRange(dns.rateLimitSubnetLengthIpv6 ?? 0, 0, 128) ||
    (dns.rateLimitAllowlist ?? []).some(
      (value) => validateNetwork(value) !== undefined,
    ) ||
    (dns.blockingMode === "custom_ip" &&
      (validateIpFamily(dns.blockingIpv4 ?? "", 4) !== undefined ||
        validateIpFamily(dns.blockingIpv6 ?? "", 6) !== undefined)) ||
    (dns.ednsClientSubnet &&
      dns.ednsUseCustom &&
      (!dns.ednsCustomIp?.trim() ||
        validateIp(dns.ednsCustomIp) !== undefined)) ||
    !validCacheSize(dns.cacheSize ?? 0, dns.cacheEnabled ?? false) ||
    !validWholeSeconds(dns.blockedResponseTtl ?? 0) ||
    !validWholeSeconds(dns.cacheTtlMin ?? 0) ||
    !validWholeSeconds(dns.cacheTtlMax ?? 0) ||
    ((dns.cacheTtlMax ?? 0) > 0 &&
      (dns.cacheTtlMin ?? 0) > (dns.cacheTtlMax ?? 0)) ||
    !validWholeSeconds(dns.upstreamTimeoutSeconds ?? 0)
  );
}

function integerInRange(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function nodeName(id: string, names: ReadonlyMap<string, string>): string {
  return names.get(id) ?? id;
}

function nodeList(
  profiles: CapabilityProfile[],
  names: ReadonlyMap<string, string>,
): string {
  return profiles.map((profile) => nodeName(profile.nodeId, names)).join(", ");
}

function UpstreamSyntaxHelp() {
  return (
    <span>
      One expression per line. Plain IPs, encrypted resolver URLs, ports, and
      AdGuard domain selectors such as{" "}
      <code>[/internal.example/]192.0.2.53</code>
      are retained exactly. A selector ending in <code>#</code> excludes
      matching names. Diagnostics are conservative; node-side upstream testing
      belongs to Phase 9C.
    </span>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  status,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  status?: string;
}) {
  return (
    <label className="general-toggle">
      <span>
        <input
          type="checkbox"
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </span>
      {status && <small>{status}</small>}
    </label>
  );
}

function EnumSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [string, string])[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  const custom = value !== "" && !knownValue(value, options);
  return (
    <Field
      label={label}
      htmlFor={id}
      help={
        custom
          ? "This imported value is not recognised by this controller version. It will be preserved until you choose a supported value."
          : undefined
      }
    >
      <select
        id={id}
        value={value || options[0]?.[0]}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {custom && (
          <option value={value}>Current value: {value} (unsupported)</option>
        )}
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  error,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  error?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error}>
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={1}
        aria-invalid={error !== undefined}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? Number.NaN : Number(event.target.value),
          )
        }
      />
    </Field>
  );
}

function TextInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = useId();
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

function CacheSizeField({
  value,
  enabled,
  onChange,
}: {
  value: number;
  enabled: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const initial = cacheSizeForDisplay(value);
  const [unit, setUnit] = useState<CacheSizeUnit>(initial.unit);
  const multiplier = cacheSizeToBytes(1, unit);
  const displayValue = value / multiplier;
  const invalid = !validCacheSize(value, enabled);
  return (
    <Field
      label="Cache size"
      htmlFor={`${id}-value`}
      error={
        invalid
          ? enabled && value === 0
            ? "Cache size must be greater than 0 when the cache is enabled."
            : "Enter a size that converts to a whole non-negative number of bytes."
          : undefined
      }
    >
      <div className="cache-size-field">
        <input
          id={`${id}-value`}
          type="number"
          min={0}
          value={Number.isFinite(displayValue) ? displayValue : ""}
          aria-invalid={invalid}
          onChange={(event) =>
            onChange(
              event.target.value === ""
                ? Number.NaN
                : cacheSizeToBytes(Number(event.target.value), unit),
            )
          }
        />
        <select
          aria-label="Cache size unit"
          value={unit}
          onChange={(event) => setUnit(event.target.value as CacheSizeUnit)}
        >
          <option value="bytes">bytes</option>
          <option value="KiB">KiB</option>
          <option value="MiB">MiB</option>
        </select>
      </div>
    </Field>
  );
}
