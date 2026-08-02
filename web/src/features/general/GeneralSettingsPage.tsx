import { useCallback, useEffect, useMemo, useState } from "react";
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
  ScopeIndicator,
  SettingRow,
  SettingsGroup,
  UnsavedChangesNotice,
} from "../../components/Settings";
import { StatusBadge } from "../../components/StatusBadge";
import {
  DomainListField,
  DurationField,
  validateDomain,
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
  SafeSearchConfiguration,
  ValidationIssue,
} from "../../lib/types";
import {
  FILTER_UPDATE_PRESETS,
  HOUR_MILLIS,
  POLICY_CUSTOM_UNITS,
  POLICY_DURATION_PRESETS,
  SAFE_SEARCH_PROVIDERS,
  validPolicyDuration,
  YEAR_MILLIS,
} from "./model";

const LEGACY_FILTER_INTERVALS = new Set([0, 1, 12, 24, 72, 168]);

export function GeneralSettingsPage({ cluster }: { cluster: Cluster }) {
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
  const [command, setCommand] = useState<"querylog" | "statistics" | "">("");
  const [commandScope, setCommandScope] = useState<
    "node" | "all_compatible_enabled_nodes"
  >("node");
  const [commandNodeID, setCommandNodeID] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandResult, setCommandResult] = useState<DNSOperationalCommand>();

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
    const key = `aghha-policy-operation:${cluster.id}`;
    const stored = window.sessionStorage.getItem(key);
    if (stored === null) return;
    try {
      const value = JSON.parse(stored) as { id?: string };
      if (typeof value.id !== "string") return;
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
            if (result.status === "succeeded") {
              window.sessionStorage.removeItem(key);
            } else {
              setCommandResult(result);
            }
          }
        } catch {
          window.sessionStorage.removeItem(key);
        }
      })();
    } catch {
      window.sessionStorage.removeItem(key);
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
  const missingFeature = (feature: string) =>
    affectedCapabilities.filter((profile) => !profile.features[feature]);
  const commandFeature =
    command === "statistics" ? "stats_reset" : "querylog_clear";
  const eligibleCommandNodes = affectedNodes.filter((node) => {
    const profile = capabilities.find((item) => item.nodeId === node.id);
    return (
      !node.maintenanceMode &&
      profile?.compatibility === "supported" &&
      profile.features[commandFeature] === true
    );
  });

  if (loading && draft === undefined) {
    return (
      <PageContainer size="full">
        <PageHeader title="General settings" />
        <LoadingSkeleton label="Loading General Settings" rows={8} />
      </PageContainer>
    );
  }
  if (error !== undefined && draft === undefined) {
    return (
      <PageContainer size="full">
        <PageHeader title="General settings" />
        <ErrorState error={error} retry={() => void load()} />
      </PageContainer>
    );
  }

  const shared = draft?.document.shared;
  const queryLog = shared?.queryLog;
  const statistics = shared?.statistics;
  const invalidDomains = [
    ...(queryLog?.ignored ?? []),
    ...(statistics?.ignored ?? []),
  ].some((domain) => validateDomain(domain) !== undefined);
  const invalidDurations =
    shared !== undefined &&
    (!Number.isInteger(shared.filtering.updateIntervalHours) ||
      shared.filtering.updateIntervalHours < 0 ||
      shared.filtering.updateIntervalHours > 8760 ||
      !validPolicyDuration(
        queryLog?.intervalMillis ?? 0,
        queryLog?.enabled ?? false,
      ) ||
      !validPolicyDuration(
        statistics?.intervalMillis ?? 0,
        statistics?.enabled ?? false,
      ));
  const inlineInvalid = invalidDomains || invalidDurations;

  async function saveDraft() {
    if (draft === undefined || inlineInvalid) return;
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

  function updateShared(
    next: (
      value: ConfigurationDraft["document"]["shared"],
    ) => ConfigurationDraft["document"]["shared"],
  ) {
    if (draft === undefined) return;
    setSaved(false);
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: next(draft.document.shared),
      },
    });
  }

  function openCommand(next: "querylog" | "statistics") {
    const feature = next === "statistics" ? "stats_reset" : "querylog_clear";
    const eligible = affectedNodes.filter((node) => {
      const profile = capabilities.find((item) => item.nodeId === node.id);
      return (
        !node.maintenanceMode &&
        profile?.compatibility === "supported" &&
        profile.features[feature] === true
      );
    });
    setCommandScope("node");
    setCommandNodeID(eligible[0]?.id ?? "");
    setCommand(next);
  }

  async function runCommand() {
    if (command === "") return;
    const target: OperationalTarget =
      commandScope === "node"
        ? { scope: "node", nodeId: commandNodeID }
        : { scope: "all_compatible_enabled_nodes" };
    setCommandBusy(true);
    setCommandResult(undefined);
    try {
      const idempotencyKey = newIdempotencyKey();
      let result =
        command === "statistics"
          ? await api.resetStatistics(cluster.id, target, idempotencyKey)
          : await api.clearQueryLog(cluster.id, target, idempotencyKey);
      setCommand("");
      setCommandResult(result);
      const key = `aghha-policy-operation:${cluster.id}`;
      window.sessionStorage.setItem(key, JSON.stringify({ id: result.id }));
      while (result.status === "queued" || result.status === "running") {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        result = await api.dnsOperation(result.id);
        setCommandResult(result);
      }
      if (result.status === "succeeded") {
        window.sessionStorage.removeItem(key);
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
    window.sessionStorage.removeItem(`aghha-policy-operation:${cluster.id}`);
  }

  const safeSearch = shared?.services.safeSearch;
  const ecosiaMissing = missingFeature("safe_search_ecosia");
  const ignoredToggleMissing = missingFeature("ignored_lists_toggle");
  const arbitraryIntervalMissing = missingFeature("filter_interval_arbitrary");
  const filterNeedsArbitraryCapability =
    shared !== undefined &&
    !LEGACY_FILTER_INTERVALS.has(shared.filtering.updateIntervalHours);

  return (
    <PageContainer size="full" className="general-settings-page">
      <PageHeader
        eyebrow="Settings"
        title="General settings"
        description="Manage cluster-wide protection, safety, and node-local logging policies in the shared desired-state draft."
        focusOnMount
        primaryAction={
          <button
            type="button"
            className="button"
            disabled={draft === undefined || saving || !dirty || inlineInvalid}
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
      ) : draft.document.schemaVersion !== 2 || shared === undefined ? (
        <Banner tone="danger" title="Unsupported draft format">
          Import a current schema-v2 observation before editing General
          Settings.
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
            Saving updates the mutable draft only. Publish an immutable revision
            in Configuration Control, then deploy it separately. Nodes continue
            serving DNS throughout the controller workflow.
          </Banner>

          {commandResult !== undefined && (
            <PolicyCommandResultPanel
              operation={commandResult}
              onDismiss={dismissCommandResult}
            />
          )}

          {filterNeedsArbitraryCapability &&
            arbitraryIntervalMissing.length > 0 && (
              <CapabilityWarning
                state="partial"
                title="Custom filter interval support differs"
              >
                The selected interval must be retained for the draft, but these
                nodes require a supported preset before publication:{" "}
                {nodeList(arbitraryIntervalMissing, nodeNames)}.
              </CapabilityWarning>
            )}
          {ignoredToggleMissing.length > 0 && (
            <CapabilityWarning
              state="partial"
              title="Ignored-domain switches differ by version"
            >
              Some nodes always apply their ignored-domain lists because they do
              not expose a separate enable switch:{" "}
              {nodeList(ignoredToggleMissing, nodeNames)}. Desired domain lists
              remain part of drift; provider availability and observed metadata
              do not.
            </CapabilityWarning>
          )}

          <SettingsGroup
            title="Protection and filtering"
            description="Shared protection behavior is revisioned desired state, not an immediate node command."
          >
            <SettingRow
              title="Protection enabled"
              description="Enable AdGuard Home protection after the published revision is deployed."
              control={
                <Toggle
                  label="Protection enabled"
                  checked={shared.dns.protectionEnabled}
                  onChange={(protectionEnabled) =>
                    updateShared((value) => ({
                      ...value,
                      dns: { ...value.dns, protectionEnabled },
                    }))
                  }
                />
              }
            />
            <SettingRow
              title="Filtering enabled"
              description="Apply filter subscriptions and custom filtering rules on managed nodes."
              control={
                <Toggle
                  label="Filtering enabled"
                  checked={shared.filtering.enabled}
                  onChange={(enabled) =>
                    updateShared((value) => ({
                      ...value,
                      filtering: { ...value.filtering, enabled },
                    }))
                  }
                />
              }
            />
            <SettingRow
              title="Filter update interval"
              description="Choose a common interval or preserve a node-imported custom number of hours."
              control={
                <DurationField
                  label="Filter update interval"
                  value={shared.filtering.updateIntervalHours}
                  unit="hours"
                  presets={FILTER_UPDATE_PRESETS}
                  min={0}
                  max={8760}
                  integer
                  invalidMessage="Choose a whole number from 0 to 8,760 hours."
                  onChange={(updateIntervalHours) =>
                    updateShared((value) => ({
                      ...value,
                      filtering: { ...value.filtering, updateIntervalHours },
                    }))
                  }
                />
              }
            />
          </SettingsGroup>

          <SettingsGroup
            title="Safety"
            description="Safety services and Safe Search are shared desired settings for every affected node."
          >
            <SettingRow
              title="Safe Browsing"
              description="Block domains reported for malware and phishing."
              control={
                <Toggle
                  label="Safe Browsing"
                  checked={shared.services.safeBrowsing}
                  onChange={(safeBrowsing) =>
                    updateShared((value) => ({
                      ...value,
                      services: { ...value.services, safeBrowsing },
                    }))
                  }
                />
              }
            />
            <SettingRow
              title="Parental control"
              description="Block domains categorised as adult content."
              control={
                <Toggle
                  label="Parental control"
                  checked={shared.services.parentalControl}
                  onChange={(parentalControl) =>
                    updateShared((value) => ({
                      ...value,
                      services: { ...value.services, parentalControl },
                    }))
                  }
                />
              }
            />
            <SettingRow
              title="Safe Search"
              description="Enable search-provider enforcement. Provider choices are retained when the master switch is off."
              control={
                <Toggle
                  label="Safe Search"
                  checked={safeSearch?.enabled ?? false}
                  onChange={(enabled) =>
                    updateSafeSearch(updateShared, shared.services.safeSearch, {
                      enabled,
                    })
                  }
                />
              }
            />
            <fieldset className="safe-search-providers">
              <legend>Safe Search providers</legend>
              <p className="field__help">
                Provider support can vary by AdGuard Home patch version. Values
                unavailable to a node remain desired metadata only where the
                existing capability contract allows them.
              </p>
              <div className="safe-search-provider-grid">
                {SAFE_SEARCH_PROVIDERS.map((provider) => {
                  const unsupported =
                    provider.key === "ecosia" && ecosiaMissing.length > 0;
                  return (
                    <Toggle
                      key={provider.key}
                      label={provider.label}
                      checked={safeSearch?.[provider.key] ?? false}
                      disabled={!safeSearch?.enabled || unsupported}
                      status={
                        unsupported ? "Unavailable on some nodes" : undefined
                      }
                      onChange={(value) =>
                        updateSafeSearch(
                          updateShared,
                          shared.services.safeSearch,
                          { [provider.key]: value },
                        )
                      }
                    />
                  );
                })}
              </div>
              {ecosiaMissing.length > 0 && (
                <CapabilityWarning
                  state="partial"
                  title="Ecosia support differs"
                >
                  Ecosia cannot be changed for the whole cluster because it is
                  unavailable on {nodeList(ecosiaMissing, nodeNames)}. Its
                  imported desired value is preserved.
                </CapabilityWarning>
              )}
            </fieldset>
          </SettingsGroup>

          <SettingsGroup
            title="Query Log policy"
            description="Configures logging inside each AdGuard Home node. The combined, node-attributed Query Log arrives in Release 0.6."
            actions={
              <button
                type="button"
                className="button button--danger"
                disabled={
                  !affectedCapabilities.some(
                    (profile) => profile.features.querylog_clear,
                  )
                }
                onClick={() => openCommand("querylog")}
              >
                Clear Query Log
              </button>
            }
          >
            <SettingRow
              title="Query logging enabled"
              description="Control whether each node retains its own query log."
              control={
                <Toggle
                  label="Query logging enabled"
                  checked={shared.queryLog.enabled}
                  onChange={(enabled) =>
                    updateQueryLog(updateShared, shared.queryLog, { enabled })
                  }
                />
              }
            />
            <SettingRow
              title="Retention"
              description="Node-local query-log rotation and retention interval."
              control={
                <DurationField
                  label="Query Log retention"
                  value={shared.queryLog.intervalMillis}
                  unit="milliseconds"
                  presets={POLICY_DURATION_PRESETS}
                  customUnits={POLICY_CUSTOM_UNITS}
                  min={shared.queryLog.enabled ? HOUR_MILLIS : 0}
                  max={YEAR_MILLIS}
                  integer
                  invalidMessage="Choose Disabled retention or an exact duration from 1 hour to 1 year."
                  onChange={(intervalMillis) =>
                    updateQueryLog(updateShared, shared.queryLog, {
                      intervalMillis,
                    })
                  }
                />
              }
            />
            <SettingRow
              title="Anonymise client IP"
              description="Ask each node to anonymise client addresses in its local query log."
              control={
                <Toggle
                  label="Anonymise client IP"
                  checked={shared.queryLog.anonymizeClientIp}
                  onChange={(anonymizeClientIp) =>
                    updateQueryLog(updateShared, shared.queryLog, {
                      anonymizeClientIp,
                    })
                  }
                />
              }
            />
            <SettingRow
              title="Apply ignored domains"
              description="Use the desired ignored-domain list for node-local query logging where supported."
              control={
                <Toggle
                  label="Apply Query Log ignored domains"
                  checked={shared.queryLog.ignoredEnabled}
                  onChange={(ignoredEnabled) =>
                    updateQueryLog(updateShared, shared.queryLog, {
                      ignoredEnabled,
                    })
                  }
                />
              }
            />
            <div className="general-domain-list">
              <DomainListField
                label="Query Log ignored domains"
                value={shared.queryLog.ignored}
                onChange={(ignored) =>
                  updateQueryLog(updateShared, shared.queryLog, { ignored })
                }
                placeholder="example.org"
                addLabel="Add domain"
                emptyMessage="No Query Log domains are ignored."
                help="Enter one DNS domain per row. Invalid domains remain visible and block saving."
              />
            </div>
          </SettingsGroup>

          <SettingsGroup
            title="Statistics policy"
            description="Configures retention inside each AdGuard Home node. Cluster statistics aggregation arrives in Release 0.5."
            actions={
              <button
                type="button"
                className="button button--danger"
                disabled={
                  !affectedCapabilities.some(
                    (profile) => profile.features.stats_reset,
                  )
                }
                onClick={() => openCommand("statistics")}
              >
                Reset Statistics
              </button>
            }
          >
            <SettingRow
              title="Statistics enabled"
              description="Control whether each node retains its own statistics."
              control={
                <Toggle
                  label="Statistics enabled"
                  checked={shared.statistics.enabled}
                  onChange={(enabled) =>
                    updateStatistics(updateShared, shared.statistics, {
                      enabled,
                    })
                  }
                />
              }
            />
            <SettingRow
              title="Retention"
              description="Node-local statistics retention interval."
              control={
                <DurationField
                  label="Statistics retention"
                  value={shared.statistics.intervalMillis}
                  unit="milliseconds"
                  presets={POLICY_DURATION_PRESETS}
                  customUnits={POLICY_CUSTOM_UNITS}
                  min={shared.statistics.enabled ? HOUR_MILLIS : 0}
                  max={YEAR_MILLIS}
                  integer
                  invalidMessage="Choose Disabled retention or an exact duration from 1 hour to 1 year."
                  onChange={(intervalMillis) =>
                    updateStatistics(updateShared, shared.statistics, {
                      intervalMillis,
                    })
                  }
                />
              }
            />
            <SettingRow
              title="Apply ignored domains"
              description="Use the desired ignored-domain list for node-local statistics where supported."
              control={
                <Toggle
                  label="Apply Statistics ignored domains"
                  checked={shared.statistics.ignoredEnabled}
                  onChange={(ignoredEnabled) =>
                    updateStatistics(updateShared, shared.statistics, {
                      ignoredEnabled,
                    })
                  }
                />
              }
            />
            <div className="general-domain-list">
              <DomainListField
                label="Statistics ignored domains"
                value={shared.statistics.ignored}
                onChange={(ignored) =>
                  updateStatistics(updateShared, shared.statistics, { ignored })
                }
                placeholder="example.org"
                addLabel="Add domain"
                emptyMessage="No Statistics domains are ignored."
                help="The enable switch above belongs to this Statistics policy; the list remains distinct from Query Log policy."
              />
            </div>
          </SettingsGroup>

          {inlineInvalid && (
            <Banner tone="danger" title="Fix inline validation errors">
              Durations must remain exact whole milliseconds within the allowed
              range, and every ignored-domain row must be a valid DNS name.
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
            command={
              command === "statistics" ? "Reset Statistics" : "Clear Query Log"
            }
            cluster={cluster.name}
            target={
              commandScope === "node"
                ? eligibleCommandNodes.find((node) => node.id === commandNodeID)
                    ?.name
                : undefined
            }
            scope={
              commandScope === "node"
                ? "Selected node"
                : `All compatible enabled nodes (${eligibleCommandNodes.length})`
            }
            consequence={
              command === "statistics"
                ? "All accumulated statistics on every target are reset immediately and permanently."
                : "All locally stored query records on every target are deleted immediately and permanently."
            }
            recoverable="No. Cleared operational data cannot be recovered by the controller."
            impact={
              command === "statistics"
                ? "Statistics enabled state, retention policy, ignored domains, draft, and revisions remain unchanged."
                : "Query logging enabled state, retention policy, ignored domains, draft, and revisions remain unchanged."
            }
            confirmationText={
              command === "statistics" ? "RESET_STATISTICS" : "CLEAR_QUERY_LOG"
            }
            busy={commandBusy}
            confirmDisabled={
              eligibleCommandNodes.length === 0 ||
              (commandScope === "node" &&
                !eligibleCommandNodes.some((node) => node.id === commandNodeID))
            }
            destructive
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

function PolicyCommandResultPanel({
  operation,
  onDismiss,
}: {
  operation: DNSOperationalCommand;
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
    message: node.errorCode,
  }));
  return (
    <>
      {operation.status === "partial_success" && (
        <PartialSuccessPanel
          title={
            operation.command === "reset_statistics"
              ? "Statistics reset partially completed"
              : "Query Log clear partially completed"
          }
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
            {operation.command === "reset_statistics"
              ? "Statistics reset result"
              : "Query Log clear result"}
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
              {node.observationStatus === "failed" &&
                ` · status refresh failed (${node.observationErrorCode})`}
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

type SharedUpdater = (
  next: (
    value: ConfigurationDraft["document"]["shared"],
  ) => ConfigurationDraft["document"]["shared"],
) => void;

function updateSafeSearch(
  update: SharedUpdater,
  current: SafeSearchConfiguration,
  patch: Partial<SafeSearchConfiguration>,
) {
  update((shared) => ({
    ...shared,
    services: {
      ...shared.services,
      safeSearch: { ...current, ...patch },
    },
  }));
}

function updateQueryLog(
  update: SharedUpdater,
  current: ConfigurationDraft["document"]["shared"]["queryLog"],
  patch: Partial<ConfigurationDraft["document"]["shared"]["queryLog"]>,
) {
  update((shared) => ({
    ...shared,
    queryLog: { ...current, ...patch },
  }));
}

function updateStatistics(
  update: SharedUpdater,
  current: ConfigurationDraft["document"]["shared"]["statistics"],
  patch: Partial<ConfigurationDraft["document"]["shared"]["statistics"]>,
) {
  update((shared) => ({
    ...shared,
    statistics: { ...current, ...patch },
  }));
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
        <span>{label}</span>
      </span>
      {status !== undefined && <small>{status}</small>}
    </label>
  );
}

function nodeList(
  profiles: CapabilityProfile[],
  names: ReadonlyMap<string, string>,
) {
  return profiles
    .map((profile) => names.get(profile.nodeId) ?? profile.nodeId)
    .join(", ");
}
