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
  Field,
  ScopeIndicator,
  SettingsGroup,
  UnsavedChangesNotice,
} from "../../components/Settings";
import { StatusBadge } from "../../components/StatusBadge";
import { RuleEditor } from "../../components/StructuredInputs";
import { api } from "../../lib/api";
import { newIdempotencyKey } from "../../lib/idempotency";
import type {
  CapabilityProfile,
  Cluster,
  ConfigurationDraft,
  DNSOperationalCommand,
  Node,
  OperationalTarget,
  ValidationIssue,
} from "../../lib/types";

const QUERY_TYPES = [
  "",
  "A",
  "AAAA",
  "ANY",
  "CAA",
  "CNAME",
  "DNSKEY",
  "DS",
  "HTTPS",
  "MX",
  "NS",
  "PTR",
  "SOA",
  "SRV",
  "SVCB",
  "TXT",
] as const;

type Scope = "node" | "all_compatible_enabled_nodes";
type TestInput = { hostname: string; client: string; queryType: string };

export function CustomRulesPage({ cluster }: { cluster: Cluster }) {
  const hostnameID = useId();
  const clientID = useId();
  const [draft, setDraft] = useState<ConfigurationDraft>();
  const [savedDocument, setSavedDocument] = useState("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityProfile[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("node");
  const [nodeID, setNodeID] = useState("");
  const [testInput, setTestInput] = useState<TestInput>({
    hostname: "",
    client: "",
    queryType: "",
  });
  const [submittedInput, setSubmittedInput] = useState<TestInput>();
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandResult, setCommandResult] = useState<DNSOperationalCommand>();
  const [proposal, setProposal] = useState(() =>
    ruleProposalFromSearch(window.location.search),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inventory, nodeResult] = await Promise.all([
        api.configurationInventory(cluster.id),
        api.nodes(cluster.id),
      ]);
      setDraft(inventory.draft);
      setSavedDocument(
        inventory.draft ? JSON.stringify(inventory.draft.document) : "",
      );
      setNodes(nodeResult.items);
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
    const key = `aghha-host-filter-operation:${cluster.id}`;
    const stored = window.sessionStorage.getItem(key);
    if (stored === null) return;
    try {
      const value = JSON.parse(stored) as {
        id?: string;
        input?: TestInput;
      };
      if (typeof value.id !== "string") return;
      if (value.input) setSubmittedInput(value.input);
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

  const enabledNodes = nodes.filter((node) => node.enabled);
  const contextual =
    testInput.client.trim() !== "" || testInput.queryType !== "";
  const requiredFeature = contextual
    ? "test_host_filtering_context"
    : "test_host_filtering";
  const eligibleNodes = enabledNodes.filter((node) => {
    const profile = capabilities.find((item) => item.nodeId === node.id);
    return (
      !node.maintenanceMode &&
      profile?.compatibility === "supported" &&
      profile.features[requiredFeature] === true
    );
  });
  const nodeNames = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.name])),
    [nodes],
  );
  const dirty =
    draft !== undefined && JSON.stringify(draft.document) !== savedDocument;
  const invalidHostname = hostError(testInput.hostname);

  function updateRules(userRules: string[]) {
    if (!draft) return;
    setSaved(false);
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: {
          ...draft.document.shared,
          filtering: { ...draft.document.shared.filtering, userRules },
        },
      },
    });
  }

  async function saveDraft() {
    if (!draft) return;
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

  function openTest() {
    const first = enabledNodes.find((node) => {
      const profile = capabilities.find((item) => item.nodeId === node.id);
      return (
        !node.maintenanceMode &&
        profile?.compatibility === "supported" &&
        profile.features.test_host_filtering
      );
    });
    setScope("node");
    setNodeID(first?.id ?? "");
    setDialogOpen(true);
  }

  async function runTest() {
    if (invalidHostname || eligibleNodes.length === 0) return;
    const target: OperationalTarget =
      scope === "node"
        ? { scope: "node", nodeId: nodeID }
        : { scope: "all_compatible_enabled_nodes" };
    const submitted = {
      hostname: testInput.hostname.trim(),
      client: testInput.client.trim(),
      queryType: testInput.queryType,
    };
    setCommandBusy(true);
    setCommandResult(undefined);
    setSubmittedInput(submitted);
    try {
      let result = await api.testHostFiltering(
        cluster.id,
        target,
        submitted,
        newIdempotencyKey(),
      );
      setDialogOpen(false);
      setCommandResult(result);
      const key = `aghha-host-filter-operation:${cluster.id}`;
      window.sessionStorage.setItem(
        key,
        JSON.stringify({ id: result.id, input: submitted }),
      );
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

  function dismissResult() {
    setCommandResult(undefined);
    setSubmittedInput(undefined);
    window.sessionStorage.removeItem(
      `aghha-host-filter-operation:${cluster.id}`,
    );
  }

  if (loading && draft === undefined) {
    return (
      <PageContainer size="full">
        <PageHeader title="Custom filter rules" />
        <LoadingSkeleton label="Loading custom filter rules" rows={6} />
      </PageContainer>
    );
  }
  if (error !== undefined && draft === undefined) {
    return (
      <PageContainer size="full">
        <PageHeader title="Custom filter rules" />
        <ErrorState error={error} retry={() => void load()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="full" className="custom-rules-page">
      <PageHeader
        eyebrow="Filters"
        title="Custom filter rules"
        description="Manage ordered cluster-wide rules and test a hostname against the filtering state currently active on selected nodes."
        focusOnMount
        primaryAction={
          <button
            type="button"
            className="button"
            disabled={!draft || saving || !dirty}
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
      {!draft ? (
        <EmptyState title="Import a node configuration first">
          Open Configuration Control, refresh a node, and import its
          observation.
        </EmptyState>
      ) : draft.document.schemaVersion !== 2 ? (
        <Banner tone="danger" title="Unsupported draft format">
          Import a current schema-v2 observation before editing custom rules.
        </Banner>
      ) : (
        <>
          <UnsavedChangesNotice dirty={dirty} saving={saving} saved={saved} />
          {proposal && (
            <Banner
              tone="info"
              title={`${proposal.action === "allow" ? "Allow" : "Block"} domain proposal`}
              actions={
                <>
                  <button
                    type="button"
                    className="button"
                    disabled={(
                      draft.document.shared.filtering.userRules ?? []
                    ).includes(proposal.rule)}
                    onClick={() => {
                      updateRules([
                        ...(draft.document.shared.filtering.userRules ?? []),
                        proposal.rule,
                      ]);
                      setProposal(undefined);
                    }}
                  >
                    Add to Draft
                  </button>
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => setProposal(undefined)}
                  >
                    Dismiss
                  </button>
                </>
              }
            >
              Review <code>{proposal.rule}</code>. Adding it changes only the
              mutable draft; Save Draft, publication, and deployment remain
              separate steps.
            </Banner>
          )}
          {commandResult && (
            <HostFilterResultPanel
              operation={commandResult}
              input={submittedInput}
              onDismiss={dismissResult}
            />
          )}
          <SettingsGroup
            title="Custom filtering rules"
            description="Rule order and comments are preserved in desired state. Testing checks active node state; it does not apply this draft."
            actions={
              <button
                type="button"
                className="button button--secondary"
                disabled={
                  !capabilities.some(
                    (profile) => profile.features.test_host_filtering,
                  )
                }
                onClick={openTest}
              >
                Test a host
              </button>
            }
          >
            <div className="dns-editor-block">
              <RuleEditor
                label="Rules"
                value={draft.document.shared.filtering.userRules ?? []}
                onChange={updateRules}
                rows={16}
                placeholder="||ads.example^"
                help="One AdGuard filtering rule per line. Comments and rule order are preserved. Save Draft does not change a node."
              />
            </div>
            <p className="muted">
              <ScopeIndicator scope="cluster" /> {enabledNodes.length} enabled
              node{enabledNodes.length === 1 ? "" : "s"} affected by a later
              deployment.
            </p>
          </SettingsGroup>
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
            open={dialogOpen}
            onClose={() => !commandBusy && setDialogOpen(false)}
            onConfirm={() => void runTest()}
            command="Test host filtering"
            cluster={cluster.name}
            target={scope === "node" ? nodeNames.get(nodeID) : undefined}
            scope={
              scope === "node"
                ? "Selected node"
                : `All compatible enabled nodes (${eligibleNodes.length})`
            }
            consequence="The hostname is checked against filtering rules active on each target node."
            recoverable="No desired state or node configuration is changed."
            impact="The hostname and optional client context are encrypted while queued and omitted from audit records."
            busy={commandBusy}
            confirmDisabled={
              invalidHostname !== undefined ||
              eligibleNodes.length === 0 ||
              (scope === "node" &&
                !eligibleNodes.some((node) => node.id === nodeID))
            }
          >
            <div className="dns-command-targets">
              <Field
                label="Hostname"
                htmlFor={hostnameID}
                required
                error={invalidHostname}
              >
                <input
                  id={hostnameID}
                  value={testInput.hostname}
                  placeholder="example.org"
                  aria-invalid={invalidHostname !== undefined}
                  disabled={commandBusy}
                  onChange={(event) =>
                    setTestInput({ ...testInput, hostname: event.target.value })
                  }
                />
              </Field>
              <Field
                label="Client (optional)"
                htmlFor={clientID}
                help="Client ID or client IP. Requires AdGuard Home 0.107.58 or newer."
              >
                <input
                  id={clientID}
                  value={testInput.client}
                  placeholder="192.0.2.10"
                  disabled={commandBusy}
                  onChange={(event) =>
                    setTestInput({ ...testInput, client: event.target.value })
                  }
                />
              </Field>
              <label>
                Query type (optional)
                <select
                  value={testInput.queryType}
                  disabled={commandBusy}
                  onChange={(event) =>
                    setTestInput({
                      ...testInput,
                      queryType: event.target.value,
                    })
                  }
                >
                  {QUERY_TYPES.map((value) => (
                    <option key={value || "none"} value={value}>
                      {value || "Any query type"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Target scope
                <select
                  value={scope}
                  disabled={commandBusy}
                  onChange={(event) => setScope(event.target.value as Scope)}
                >
                  <option value="node">Selected node</option>
                  <option value="all_compatible_enabled_nodes">
                    All compatible enabled nodes
                  </option>
                </select>
              </label>
              {scope === "node" && (
                <label>
                  Node
                  <select
                    value={nodeID}
                    disabled={commandBusy}
                    onChange={(event) => setNodeID(event.target.value)}
                  >
                    {eligibleNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {eligibleNodes.length === 0 && (
                <Banner tone="warning" title="No compatible targets">
                  Remove optional client/query-type context or refresh node
                  capability data.
                </Banner>
              )}
            </div>
          </OperationalCommandDialog>
        </>
      )}
    </PageContainer>
  );
}

export function ruleProposalFromSearch(
  search: string,
): { action: "allow" | "block"; rule: string } | undefined {
  const parameters = new URLSearchParams(search);
  const action = parameters.get("action");
  const domain = parameters.get("domain")?.trim().toLowerCase();
  if (
    (action !== "allow" && action !== "block") ||
    !domain ||
    domain.length > 253 ||
    /[^a-z0-9._-]/u.test(domain)
  )
    return undefined;
  return {
    action,
    rule: action === "allow" ? `@@||${domain}^` : `||${domain}^`,
  };
}

function HostFilterResultPanel({
  operation,
  input,
  onDismiss,
}: {
  operation: DNSOperationalCommand;
  input?: TestInput;
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
          title="Host filtering test partially completed"
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
          <h2>Host filtering test result</h2>
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
        {input && (
          <p>
            Checked <strong>{input.hostname}</strong>.
          </p>
        )}
        <ul className="compact-list">
          {operation.nodeResults.map((node) => {
            const result = node.hostFilterResult;
            return (
              <li key={node.id}>
                <strong>{node.nodeName}</strong>: {node.status}
                {node.errorCode ? ` (${node.errorCode})` : ""}
                {result && (
                  <div>
                    {result.reason || (result.matched ? "Matched" : "No match")}
                    {result.serviceName && ` · service ${result.serviceName}`}
                    {result.canonicalName && ` · CNAME ${result.canonicalName}`}
                    {result.ipAddresses &&
                      result.ipAddresses.length > 0 &&
                      ` · ${result.ipAddresses.join(", ")}`}
                    {result.rules.length > 0 && (
                      <ul>
                        {result.rules.map((rule) => (
                          <li key={`${rule.filterListId}-${rule.text}`}>
                            <code>{rule.text}</code>
                            {rule.filterListId > 0
                              ? ` (filter ${rule.filterListId})`
                              : " (custom rule)"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
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

function hostError(value: string): string | undefined {
  const hostname = value.trim();
  if (hostname === "") return "Enter a hostname.";
  if (hostname.length > 253 || /[\s/?#]/u.test(hostname)) {
    return "Enter a hostname without a URL scheme, path, or spaces.";
  }
  return undefined;
}
