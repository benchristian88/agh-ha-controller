import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type OperationResult,
  PartialSuccessPanel,
} from "../../components/DataDisplay";
import {
  Banner,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/Feedback";
import { PageContainer, PageHeader } from "../../components/Page";
import {
  CapabilityWarning,
  ScopeIndicator,
  SettingsGroup,
  UnsavedChangesNotice,
} from "../../components/Settings";
import { StatusBadge } from "../../components/StatusBadge";
import { ApiError, api } from "../../lib/api";
import type {
  Cluster,
  ConfigurationDraft,
  ConfigurationRevision,
  FilterListPresentation,
  Node,
  ValidationIssue,
} from "../../lib/types";
import {
  FilterListEditorDialog,
  type FilterListEditorState,
  FilterListRefreshDialog,
  FilterListRemoveDialog,
  FilterListResultsDialog,
} from "./FilterListDialogs";
import { FilterListTable } from "./FilterListTable";
import {
  buildFilterListRows,
  type FilterListRow,
  validateFilterListURL,
} from "./model";

export type FilterListKind = "blocklist" | "allowlist";

const copy = {
  blocklist: {
    title: "DNS Blocklists",
    noun: "blocklist",
    field: "filterUrls",
    whitelist: false,
    description:
      "Manage the cluster-wide desired set of portable blocklist URLs. Observed names, counters, and update times remain node metadata.",
  },
  allowlist: {
    title: "DNS Allowlists",
    noun: "allowlist",
    field: "whitelistUrls",
    whitelist: true,
    description:
      "Manage the cluster-wide desired set of portable allowlist URLs. Observed names, counters, and update times remain node metadata.",
  },
} as const;

export function FilterListsPage({
  cluster,
  kind,
}: {
  cluster: Cluster;
  kind: FilterListKind;
}) {
  const config = copy[kind];
  const plural = `${config.noun}s`;
  const [draft, setDraft] = useState<ConfigurationDraft>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [revisions, setRevisions] = useState<ConfigurationRevision[]>([]);
  const [presentation, setPresentation] = useState<FilterListPresentation>();
  const [savedDocument, setSavedDocument] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<FilterListEditorState>();
  const [editorError, setEditorError] = useState<string>();
  const [removing, setRemoving] = useState<FilterListRow>();
  const [details, setDetails] = useState<FilterListRow>();
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResults, setRefreshResults] = useState<OperationResult[]>([]);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const loadPresentation = useCallback(
    () =>
      kind === "allowlist"
        ? api.allowlistPresentation(cluster.id)
        : api.blocklistPresentation(cluster.id),
    [cluster.id, kind],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inventory, nodeResult, revisionResult, metadata] =
        await Promise.all([
          api.configurationInventory(cluster.id),
          api.nodes(cluster.id),
          api.configurationRevisions(cluster.id),
          loadPresentation(),
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
  }, [cluster.id, loadPresentation]);

  useEffect(() => void load(), [load]);

  const activeRevision = revisions.find(
    (revision) => revision.active || revision.id === cluster.activeRevisionId,
  );
  const desiredURLs = draft?.document.shared.filtering[config.field] ?? [];
  const activeURLs =
    activeRevision?.document.shared.filtering[config.field] ?? [];
  const rows = useMemo(
    () => buildFilterListRows(desiredURLs, activeURLs, presentation),
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

  const setFilterURLs = (urls: string[]) => {
    if (draft === undefined) return;
    setSaved(false);
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: {
          ...draft.document.shared,
          filtering: {
            ...draft.document.shared.filtering,
            [config.field]: urls,
          },
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
    const validation = validateFilterListURL(
      value,
      desiredURLs,
      config.noun,
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
    closeEditor();
  }

  function closeEditor() {
    setEditor(undefined);
    setEditorError(undefined);
  }

  function removeFromDesired(row: FilterListRow) {
    setFilterURLs(
      desiredURLs.filter((url) => url.toLowerCase() !== row.url.toLowerCase()),
    );
    setRemoving(undefined);
  }

  function toggleDesired(row: FilterListRow, enabled: boolean) {
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
          await api.refreshFilters(node.id, config.whitelist);
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
      setPresentation(await loadPresentation());
    } catch (caught) {
      setError(caught);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && draft === undefined) {
    return (
      <PageContainer size="full">
        <PageHeader title={config.title} />
        <LoadingSkeleton label={`Loading DNS ${plural}`} rows={8} />
      </PageContainer>
    );
  }
  if (error !== undefined && draft === undefined) {
    return (
      <PageContainer size="full">
        <PageHeader title={config.title} />
        <ErrorState error={error} retry={() => void load()} />
      </PageContainer>
    );
  }

  const failedRefresh = refreshResults.some(
    (result) => result.status === "failed",
  );
  return (
    <PageContainer size="full" className={`filter-lists-page ${plural}-page`}>
      <PageHeader
        eyebrow="Filters"
        title={config.title}
        description={config.description}
        primaryAction={
          <button
            type="button"
            className="button"
            disabled={draft === undefined || saving}
            onClick={() => setEditor({ mode: "add", value: "https://" })}
          >
            Add {config.noun}
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
          Import a current schema-v2 observation before editing {plural}.
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
                title={`${titleCase(config.noun)} refresh completed with node failures`}
                results={refreshResults}
              />
            ) : (
              <section
                className="card filter-list-refresh-results"
                role="status"
              >
                <h2>
                  {refreshing
                    ? `Refreshing ${plural}`
                    : `${titleCase(config.noun)} refresh complete`}
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
            title={`${titleCase(config.noun)} subscriptions`}
            description="Search the desired URLs and node-reported list metadata. Save Draft, Publish, and Deploy remain separate actions."
            actions={
              <button
                type="button"
                className="button button--secondary"
                disabled
                title={`AdGuard Home supports refreshing all ${plural}, not selected URLs.`}
              >
                Refresh selected
              </button>
            }
          >
            <div className="filter-list-table-toolbar">
              <label>
                Search {plural}
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name or URL"
                />
              </label>
              <p className="muted" id="selected-refresh-help">
                Selected refresh is unavailable: the node API only supports
                refreshing the complete {config.noun} category.
              </p>
            </div>
            <FilterListTable
              rows={filteredRows}
              noun={config.noun}
              stale={presentation?.stale}
              filtered={search.trim() !== ""}
              onToggle={toggleDesired}
              onEdit={(row) => {
                setEditor({
                  mode: "edit",
                  previousURL: row.url,
                  value: row.url,
                });
                setEditorError(undefined);
              }}
              onRemove={setRemoving}
              onDetails={setDetails}
            />
          </SettingsGroup>

          {issues.filter((issue) => issue.field.includes(config.field)).length >
            0 && (
            <Banner
              tone="warning"
              title={`${titleCase(config.noun)} validation needs attention`}
            >
              <ul className="compact-list">
                {issues
                  .filter((issue) => issue.field.includes(config.field))
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

      <FilterListEditorDialog
        editor={editor}
        error={editorError}
        noun={config.noun}
        inputRef={urlInputRef}
        onChange={(value) => {
          setEditor((current) =>
            current === undefined ? current : { ...current, value },
          );
          setEditorError(undefined);
        }}
        onClose={closeEditor}
        onSubmit={saveEditor}
      />
      <FilterListRemoveDialog
        row={removing}
        noun={config.noun}
        onClose={() => setRemoving(undefined)}
        onConfirm={() => removing && removeFromDesired(removing)}
      />
      <FilterListRefreshDialog
        open={refreshOpen}
        noun={config.noun}
        targetCount={refreshTargets.length}
        onClose={() => setRefreshOpen(false)}
        onConfirm={() => void refreshAll()}
      />
      <FilterListResultsDialog
        row={details}
        noun={config.noun}
        onClose={() => setDetails(undefined)}
      />
    </PageContainer>
  );
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

function safeError(error: unknown): string {
  if (error instanceof ApiError) return `${error.message} (${error.code})`;
  return error instanceof Error ? error.message : "Something went wrong.";
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
