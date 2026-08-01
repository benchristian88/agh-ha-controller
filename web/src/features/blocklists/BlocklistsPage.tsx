import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DataTable,
  type DataTableColumn,
  type OperationResult,
  PartialSuccessPanel,
} from "../../components/DataDisplay";
import {
  Banner,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/Feedback";
import {
  ConfirmDialog,
  Dialog,
  OperationalCommandDialog,
} from "../../components/Overlays";
import { PageContainer, PageHeader } from "../../components/Page";
import {
  CapabilityWarning,
  Field,
  ScopeIndicator,
  SettingsGroup,
  UnsavedChangesNotice,
} from "../../components/Settings";
import { StatusBadge, type StatusKind } from "../../components/StatusBadge";
import { ApiError, api } from "../../lib/api";
import type {
  BlocklistPresentation,
  Cluster,
  ConfigurationDraft,
  ConfigurationRevision,
  Node,
  ValidationIssue,
} from "../../lib/types";
import {
  type BlocklistApplicationState,
  type BlocklistRow,
  buildBlocklistRows,
  validateBlocklistURL,
} from "./model";

interface EditorState {
  mode: "add" | "edit";
  previousURL?: string;
  value: string;
}

export function BlocklistsPage({ cluster }: { cluster: Cluster }) {
  const [draft, setDraft] = useState<ConfigurationDraft>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [revisions, setRevisions] = useState<ConfigurationRevision[]>([]);
  const [presentation, setPresentation] = useState<BlocklistPresentation>();
  const [savedDocument, setSavedDocument] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState>();
  const [editorError, setEditorError] = useState<string>();
  const [removing, setRemoving] = useState<BlocklistRow>();
  const [details, setDetails] = useState<BlocklistRow>();
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResults, setRefreshResults] = useState<OperationResult[]>([]);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inventory, nodeResult, revisionResult, metadata] =
        await Promise.all([
          api.configurationInventory(cluster.id),
          api.nodes(cluster.id),
          api.configurationRevisions(cluster.id),
          api.blocklistPresentation(cluster.id),
        ]);
      setDraft(inventory.draft);
      setSavedDocument(
        inventory.draft ? JSON.stringify(inventory.draft.document) : "",
      );
      setNodes(nodeResult.items);
      setRevisions(revisionResult.items);
      setPresentation(metadata);
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

  const activeRevision = revisions.find(
    (revision) => revision.active || revision.id === cluster.activeRevisionId,
  );
  const desiredURLs = draft?.document.shared.filtering.filterUrls ?? [];
  const activeURLs = activeRevision?.document.shared.filtering.filterUrls ?? [];
  const rows = useMemo(
    () => buildBlocklistRows(desiredURLs, activeURLs, presentation),
    [activeURLs, desiredURLs, presentation],
  );
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === "") return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.url.toLowerCase().includes(query),
    );
  }, [rows, search]);
  const dirty =
    draft !== undefined && JSON.stringify(draft.document) !== savedDocument;
  const affectedNodes = nodes.filter((node) => node.enabled);
  const refreshTargets = affectedNodes.filter((node) => !node.maintenanceMode);
  const unavailableNodes =
    presentation?.nodes.filter(
      (node) => node.status !== "available" && node.status !== "stale",
    ) ?? [];

  const setFilterURLs = (filterUrls: string[]) => {
    if (draft === undefined) return;
    setSaved(false);
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: {
          ...draft.document.shared,
          filtering: { ...draft.document.shared.filtering, filterUrls },
        },
      },
    });
  };

  async function saveDraft() {
    if (draft === undefined) return;
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

  function saveEditor() {
    if (editor === undefined) return;
    const value = editor.value.trim();
    const validation = validateBlocklistURL(
      value,
      desiredURLs,
      editor.previousURL,
    );
    if (validation !== undefined) {
      setEditorError(validation);
      return;
    }
    const next = desiredURLs.filter(
      (url) => url.toLowerCase() !== editor.previousURL?.toLowerCase(),
    );
    next.push(value);
    setFilterURLs(next);
    setEditor(undefined);
    setEditorError(undefined);
  }

  function removeFromDesired(row: BlocklistRow) {
    setFilterURLs(
      desiredURLs.filter((url) => url.toLowerCase() !== row.url.toLowerCase()),
    );
    setRemoving(undefined);
  }

  function toggleDesired(row: BlocklistRow, enabled: boolean) {
    if (!enabled) {
      setRemoving(row);
      return;
    }
    if (!row.portable) return;
    setFilterURLs([...desiredURLs, row.url]);
  }

  async function refreshAll() {
    setRefreshOpen(false);
    setRefreshing(true);
    setRefreshResults(
      refreshTargets.map((node) => ({
        id: node.id,
        label: node.name,
        status: "pending",
        message: "Refresh requested",
      })),
    );
    await Promise.all(
      refreshTargets.map(async (node) => {
        try {
          await api.refreshFilters(node.id, false);
          setRefreshResults((current) =>
            updateOperation(
              current,
              node.id,
              "success",
              "Refresh succeeded and was audited.",
            ),
          );
        } catch (caught) {
          setRefreshResults((current) =>
            updateOperation(current, node.id, "failed", safeError(caught)),
          );
        }
      }),
    );
    try {
      setPresentation(await api.blocklistPresentation(cluster.id));
    } catch (caught) {
      setError(caught);
    } finally {
      setRefreshing(false);
    }
  }

  const columns: readonly DataTableColumn<BlocklistRow>[] = [
    {
      id: "enabled",
      header: "Enabled",
      render: (row) => (
        <label className="blocklist-toggle">
          <span className="visually-hidden">
            {row.desired ? "Disable" : "Enable"} {row.name}
          </span>
          <input
            type="checkbox"
            checked={row.desired}
            disabled={!row.desired && !row.portable}
            onChange={(event) => toggleDesired(row, event.target.checked)}
          />
        </label>
      ),
    },
    {
      id: "name",
      header: "Name",
      render: (row) => (
        <span>
          <strong>{row.mixedName ? "Mixed names" : row.name}</strong>
          {row.mixedName && (
            <span className="table-subtitle">See per-node results</span>
          )}
        </span>
      ),
    },
    {
      id: "url",
      header: "URL",
      className: "blocklist-url-column",
      render: (row) => (
        <span className="monospace blocklist-url">
          {row.url}
          {!row.portable && (
            <span className="table-subtitle">Local path · observed only</span>
          )}
        </span>
      ),
    },
    {
      id: "rules",
      header: "Rule count",
      render: (row) =>
        row.mixedRuleCount
          ? "Mixed"
          : (row.ruleCount?.toLocaleString() ?? "Not observed"),
    },
    {
      id: "updated",
      header: "Last updated",
      render: (row) =>
        row.mixedLastUpdated ? "Mixed" : formatTimestamp(row.lastUpdated),
    },
    {
      id: "draft",
      header: "Draft state",
      render: (row) => <DraftStateBadge row={row} />,
    },
    {
      id: "application",
      header: "Node application",
      render: (row) => <ApplicationBadge state={row.applicationState} />,
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="row-actions blocklist-actions">
          <button
            className="button button--quiet"
            type="button"
            onClick={() => setDetails(row)}
          >
            Per-node results
          </button>
          {row.desired && (
            <button
              className="button button--quiet"
              type="button"
              onClick={() => {
                setEditor({
                  mode: "edit",
                  previousURL: row.url,
                  value: row.url,
                });
                setEditorError(undefined);
              }}
            >
              Edit
            </button>
          )}
          {row.desired && (
            <button
              className="button button--danger"
              type="button"
              onClick={() => setRemoving(row)}
            >
              Remove
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading && draft === undefined) {
    return (
      <PageContainer size="full">
        <PageHeader title="DNS Blocklists" />
        <LoadingSkeleton label="Loading DNS blocklists" rows={8} />
      </PageContainer>
    );
  }
  if (error !== undefined && draft === undefined) {
    return (
      <PageContainer size="full">
        <PageHeader title="DNS Blocklists" />
        <ErrorState error={error} retry={() => void load()} />
      </PageContainer>
    );
  }

  const failedRefresh = refreshResults.some(
    (result) => result.status === "failed",
  );
  return (
    <PageContainer size="full" className="blocklists-page">
      <PageHeader
        eyebrow="Filters"
        title="DNS Blocklists"
        description="Manage the cluster-wide desired set of portable blocklist URLs. Observed names, counters, and update times remain node metadata."
        primaryAction={
          <button
            type="button"
            className="button"
            disabled={draft === undefined || saving}
            onClick={() => setEditor({ mode: "add", value: "https://" })}
          >
            Add blocklist
          </button>
        }
        secondaryActions={
          <button
            type="button"
            className="button button--secondary"
            disabled={refreshing || refreshTargets.length === 0}
            onClick={() => setRefreshOpen(true)}
          >
            {refreshing ? "Refreshing…" : "Refresh all"}
          </button>
        }
      />

      {error !== undefined && (
        <Banner tone="danger" title="The latest request failed">
          {safeError(error)}
        </Banner>
      )}
      {draft === undefined ? (
        <EmptyState title="Import a node configuration first">
          <p>
            Open Configuration Control, refresh a node, and import its
            observation to create the cluster draft.
          </p>
        </EmptyState>
      ) : draft.document.schemaVersion !== 2 ? (
        <Banner tone="danger" title="Unsupported draft format">
          Import a current schema-v2 observation before editing blocklists.
        </Banner>
      ) : (
        <>
          <UnsavedChangesNotice
            dirty={dirty}
            saving={saving}
            saved={saved}
            onSave={() => void saveDraft()}
          />

          <SettingsGroup title="Scope and state">
            <dl className="blocked-services-state">
              <div>
                <dt>Scope</dt>
                <dd>
                  <ScopeIndicator scope="cluster" />
                </dd>
              </div>
              <div>
                <dt>Current draft</dt>
                <dd>Version {draft.version}</dd>
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

          <Banner tone="info" title="Removal is disable-oriented">
            Removing a URL changes the draft only. After publication and
            deployment, the controller disables that list on managed nodes; it
            does not delete the node entry.
          </Banner>
          {presentation?.stale && (
            <CapabilityWarning state="stale">
              Cached per-node list metadata is shown because a current node read
              failed. Volatile metadata never affects drift.
            </CapabilityWarning>
          )}
          {(presentation?.partial || unavailableNodes.length > 0) && (
            <CapabilityWarning
              state="partial"
              title="Some node metadata is unavailable"
            >
              <ul className="compact-list">
                {unavailableNodes.map((node) => (
                  <li key={node.nodeId}>
                    {node.nodeName}: {node.status}
                    {node.errorCode ? ` (${node.errorCode})` : ""}
                  </li>
                ))}
              </ul>
            </CapabilityWarning>
          )}

          {refreshResults.length > 0 &&
            (failedRefresh ? (
              <PartialSuccessPanel
                title="Blocklist refresh completed with node failures"
                results={refreshResults}
              />
            ) : (
              <section className="card blocklist-refresh-results" role="status">
                <h2>
                  {refreshing
                    ? "Refreshing blocklists"
                    : "Blocklist refresh complete"}
                </h2>
                <ul>
                  {refreshResults.map((result) => (
                    <li key={result.id}>
                      <StatusBadge status={result.status} />
                      <span>
                        <strong>{result.label}</strong>
                        <small>{result.message}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

          <SettingsGroup
            title="Blocklist subscriptions"
            description="Search the desired URLs and node-reported list metadata. Save Draft, Publish, and Deploy remain separate actions."
            actions={
              <button
                type="button"
                className="button button--secondary"
                disabled
                title="AdGuard Home supports refreshing all blocklists, not selected URLs."
              >
                Refresh selected
              </button>
            }
          >
            <div className="blocklist-table-toolbar">
              <label>
                Search blocklists
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name or URL"
                />
              </label>
              <p className="muted" id="selected-refresh-help">
                Selected refresh is unavailable: the node API only supports
                refreshing the complete blocklist category.
              </p>
            </div>
            <DataTable
              columns={columns}
              rows={filteredRows}
              rowKey={(row) => row.key}
              caption="DNS blocklists in desired and observed state"
              stale={presentation?.stale}
              emptyTitle={
                search.trim() === "" ? "No blocklists" : "No blocklists match"
              }
              emptyDescription={
                search.trim() === ""
                  ? "Add an HTTP or HTTPS subscription URL to the draft."
                  : "Change the search to see other subscriptions."
              }
              filteredEmpty={search.trim() !== ""}
            />
          </SettingsGroup>

          {issues.filter((issue) => issue.field.includes("filterUrls")).length >
            0 && (
            <Banner tone="warning" title="Blocklist validation needs attention">
              <ul className="compact-list">
                {issues
                  .filter((issue) => issue.field.includes("filterUrls"))
                  .map((issue) => (
                    <li key={`${issue.field}-${issue.message}`}>
                      {issue.message}
                    </li>
                  ))}
              </ul>
            </Banner>
          )}
        </>
      )}

      <Dialog
        open={editor !== undefined}
        onClose={() => {
          setEditor(undefined);
          setEditorError(undefined);
        }}
        title={editor?.mode === "edit" ? "Edit blocklist" : "Add blocklist"}
        description="This updates the mutable draft only. Nodes remain unchanged until publish and deploy."
        initialFocusRef={urlInputRef}
        actions={
          <>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setEditor(undefined)}
            >
              Cancel
            </button>
            <button type="submit" form="blocklist-editor" className="button">
              Save to draft
            </button>
          </>
        }
      >
        <form
          id="blocklist-editor"
          onSubmit={(event) => {
            event.preventDefault();
            saveEditor();
          }}
        >
          <Field
            label="Blocklist URL"
            htmlFor="blocklist-url"
            required
            error={editorError}
            help="Use an absolute HTTP or HTTPS URL. Local file paths are not assumed portable across nodes and cannot be added to desired state."
          >
            <input
              ref={urlInputRef}
              id="blocklist-url"
              type="text"
              inputMode="url"
              value={editor?.value ?? ""}
              aria-invalid={editorError !== undefined}
              onChange={(event) => {
                setEditor((current) =>
                  current === undefined
                    ? current
                    : { ...current, value: event.target.value },
                );
                setEditorError(undefined);
              }}
            />
          </Field>
          <Banner tone="info" title="Name is observed metadata">
            AdGuard Home reports the list name. The controller does not put that
            node-managed label into the desired configuration or its hash.
          </Banner>
          {editor?.mode === "edit" &&
            editor.value.trim() !== editor.previousURL && (
              <Banner tone="warning" title="Effective reconciliation preview">
                Deployment will add and enable the new URL, then disable the old
                URL where it remains enabled. The old node entry is not deleted.
              </Banner>
            )}
        </form>
      </Dialog>

      <ConfirmDialog
        open={removing !== undefined}
        onClose={() => setRemoving(undefined)}
        onConfirm={() => removing && removeFromDesired(removing)}
        title="Remove blocklist from desired configuration?"
        description={removing?.name}
        confirmLabel="Remove from draft"
      >
        <p>
          This removes <span className="monospace">{removing?.url}</span> from
          the mutable draft. Saving does not change nodes. If this draft is
          published and deployed, the controller disables the list on managed
          nodes and does not delete it.
        </p>
      </ConfirmDialog>

      <OperationalCommandDialog
        open={refreshOpen}
        onClose={() => setRefreshOpen(false)}
        onConfirm={() => void refreshAll()}
        command="Refresh all blocklists"
        scope={`${refreshTargets.length} enabled node(s) outside maintenance`}
        impact="Every enabled blocklist subscription on each target node is refreshed. The command is audited per node and creates no configuration revision."
      />

      <Dialog
        open={details !== undefined}
        onClose={() => setDetails(undefined)}
        title={details?.name ?? "Per-node blocklist results"}
        description={details?.url}
        size="large"
        actions={
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setDetails(undefined)}
          >
            Close
          </button>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Node</th>
                <th>Application</th>
                <th>Name</th>
                <th>Rules</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {(details?.nodes ?? []).map((node) => (
                <tr key={node.nodeId}>
                  <td>
                    <strong>{node.nodeName}</strong>
                    {node.errorCode && (
                      <span className="table-subtitle">{node.errorCode}</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge
                      status={nodeStatus(node, details?.desired ?? false)}
                    />
                  </td>
                  <td>{node.list?.name || "Not observed"}</td>
                  <td>{node.list?.ruleCount.toLocaleString() ?? "—"}</td>
                  <td>{formatTimestamp(node.list?.lastUpdated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Dialog>
    </PageContainer>
  );
}

function DraftStateBadge({ row }: { row: BlocklistRow }) {
  const values: Record<BlocklistRow["draftState"], [StatusKind, string]> = {
    unchanged: ["success", "Unchanged"],
    added: ["info", "Added to draft"],
    removal_pending: ["warning", "Removal pending"],
    observed_only: ["observed", "Observed only"],
  };
  const [status, label] = values[row.draftState];
  return <StatusBadge status={status} label={label} />;
}

function ApplicationBadge({ state }: { state: BlocklistApplicationState }) {
  const values: Record<BlocklistApplicationState, [StatusKind, string]> = {
    applied: ["converged", "Applied on all nodes"],
    pending: ["pending", "Pending deployment"],
    mixed: ["warning", "Mixed node state"],
    disabled: ["disabled", "Disabled on nodes"],
    unavailable: ["failed", "Metadata unavailable"],
  };
  const [status, label] = values[state];
  return <StatusBadge status={status} label={label} />;
}

function nodeStatus(
  node: BlocklistRow["nodes"][number],
  desired: boolean,
): StatusKind {
  if (node.status === "stale") return "stale";
  if (node.status === "unsupported") return "unsupported";
  if (node.status === "error") return "failed";
  if (desired) return node.list?.enabled ? "converged" : "pending";
  return node.list?.enabled ? "pending" : "disabled";
}

function updateOperation(
  results: OperationResult[],
  id: string,
  status: OperationResult["status"],
  message: string,
): OperationResult[] {
  return results.map((result) =>
    result.id === id ? { ...result, status, message } : result,
  );
}

function formatTimestamp(value?: string): string {
  if (value === undefined || value === "") return "Not observed";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Invalid node time"
    : date.toLocaleString();
}

function safeError(error: unknown): string {
  if (error instanceof ApiError) return `${error.message} (${error.code})`;
  return error instanceof Error ? error.message : "Something went wrong.";
}
