import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConvergenceSummary,
  DataTable,
  type DataTableColumn,
} from "../../components/DataDisplay";
import {
  Banner,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/Feedback";
import { ConfirmDialog, Dialog } from "../../components/Overlays";
import { PageContainer, PageHeader } from "../../components/Page";
import {
  CapabilityWarning,
  Field,
  SettingRow,
  SettingsGroup,
  UnsavedChangesNotice,
} from "../../components/Settings";
import { StatusBadge, type StatusKind } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import type {
  CapabilityProfile,
  Cluster,
  ConfigurationDraft,
  Node,
  Rewrite,
  ValidationIssue,
} from "../../lib/types";
import {
  cleanRewriteForDraft,
  hasRewriteValidationErrors,
  inferRewriteType,
  rewriteChangeState,
  rewriteMatchesSearch,
  validateRewrite,
} from "./model";

type RewriteEditor = {
  mode: "add" | "edit";
  index?: number;
  rewrite: Rewrite;
};

type RewriteRow = { rewrite: Rewrite; index: number };

const emptyRewrite = (): Rewrite => ({
  domain: "",
  answer: "",
  enabled: true,
});

export function RewritesPage({ cluster }: { cluster: Cluster }) {
  const [draft, setDraft] = useState<ConfigurationDraft>();
  const [savedDocument, setSavedDocument] = useState("");
  const [savedRewrites, setSavedRewrites] = useState<Rewrite[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityProfile[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<RewriteEditor | undefined>(() =>
    rewriteProposalFromSearch(window.location.search),
  );
  const [removeIndex, setRemoveIndex] = useState<number>();

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
      setSavedRewrites(
        (inventory.draft?.document.shared.rewrites ?? []).map(cloneRewrite),
      );
      setCapabilities(inventory.capabilities);
      setNodes(nodeResult.items);
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

  const rewrites = draft?.document.shared.rewrites ?? [];
  const dirty =
    draft !== undefined && JSON.stringify(draft.document) !== savedDocument;
  const rows = rewrites
    .map((rewrite, index) => ({ rewrite, index }))
    .filter(({ rewrite }) => rewriteMatchesSearch(rewrite, search));
  const enabledNodes = useMemo(
    () => nodes.filter((node) => node.enabled),
    [nodes],
  );
  const capability = rewriteToggleCapability(enabledNodes, capabilities);
  const convergence = convergencePresentation(enabledNodes);
  const pendingRemovals = savedRewrites.filter(
    (savedRewrite) =>
      !rewrites.some((rewrite) => samePair(rewrite, savedRewrite)),
  );

  function setRewrites(value: Rewrite[]) {
    if (draft === undefined) return;
    setSaved(false);
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: { ...draft.document.shared, rewrites: value },
      },
    });
  }

  function setRewritesEnabled(rewritesEnabled: boolean) {
    if (draft === undefined || !capability.supported) return;
    setSaved(false);
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: { ...draft.document.shared, rewritesEnabled },
      },
    });
  }

  function commitEditor(rewrite: Rewrite) {
    if (editor === undefined) return;
    const cleaned = cleanRewriteForDraft(rewrite);
    if (editor.mode === "add") setRewrites([...rewrites, cleaned]);
    else if (editor.index !== undefined)
      setRewrites(
        rewrites.map((current, index) =>
          index === editor.index ? cleaned : current,
        ),
      );
    setEditor(undefined);
  }

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
      setSavedRewrites(
        (result.draft.document.shared.rewrites ?? []).map(cloneRewrite),
      );
      setIssues(result.issues);
      setSaved(true);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  const columns: readonly DataTableColumn<RewriteRow>[] = [
    {
      id: "domain",
      header: "Domain",
      render: ({ rewrite }) => (
        <span className="rewrite-value">
          <strong>{rewrite.domain}</strong>
          {!rewrite.enabled && (
            <StatusBadge status="info" label="Entry disabled" />
          )}
        </span>
      ),
    },
    {
      id: "answer",
      header: "Answer",
      render: ({ rewrite }) => (
        <code className="rewrite-answer">{rewrite.answer}</code>
      ),
    },
    {
      id: "type",
      header: "Inferred type",
      render: ({ rewrite }) => (
        <StatusBadge
          status={inferRewriteType(rewrite) === "Unknown" ? "warning" : "info"}
          label={inferRewriteType(rewrite)}
        />
      ),
    },
    {
      id: "draft",
      header: "Draft/change state",
      render: ({ rewrite, index }) => {
        const state = rewriteChangeState(
          rewrite,
          index,
          savedRewrites,
          rewrites,
        );
        return (
          <StatusBadge
            status={
              state === "added"
                ? "success"
                : state === "modified"
                  ? "warning"
                  : "info"
            }
            label={
              state === "unchanged"
                ? "In saved draft"
                : state === "added"
                  ? "Added"
                  : "Modified"
            }
          />
        );
      },
    },
    {
      id: "convergence",
      header: "Node convergence",
      render: () => (
        <StatusBadge status={convergence.status} label={convergence.label} />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      render: ({ rewrite, index }) => (
        <div className="row-actions rewrite-table__actions">
          <button
            type="button"
            className="button button--quiet"
            aria-label={`Edit ${rewrite.domain} to ${rewrite.answer}`}
            onClick={() =>
              setEditor({
                mode: "edit",
                index,
                rewrite: cloneRewrite(rewrite),
              })
            }
          >
            Edit
          </button>
          <button
            type="button"
            className="button button--danger"
            aria-label={`Delete ${rewrite.domain} to ${rewrite.answer}`}
            onClick={() => setRemoveIndex(index)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (loading && draft === undefined)
    return (
      <PageContainer size="full">
        <PageHeader title="DNS Rewrites" />
        <LoadingSkeleton label="Loading DNS rewrites" rows={6} />
      </PageContainer>
    );
  if (error !== undefined && draft === undefined)
    return (
      <PageContainer size="full">
        <PageHeader title="DNS Rewrites" />
        <ErrorState error={error} retry={() => void load()} />
      </PageContainer>
    );

  const removeRewrite =
    removeIndex === undefined ? undefined : rewrites[removeIndex];

  return (
    <PageContainer size="full">
      <PageHeader
        eyebrow="Filters"
        title="DNS Rewrites"
        description="Manage cluster-wide legacy DNS rewrites in the desired-state draft. Nodes change only after publication and deployment."
        primaryAction={
          <button
            type="button"
            className="button"
            disabled={draft === undefined || saving}
            onClick={() => void saveDraft()}
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>
        }
        secondaryActions={
          <button
            type="button"
            className="button button--secondary"
            disabled={draft === undefined || draft.document.schemaVersion !== 2}
            onClick={() => setEditor({ mode: "add", rewrite: emptyRewrite() })}
          >
            Add Rewrite
          </button>
        }
      />

      {error !== undefined && (
        <Banner tone="danger" title="The latest request failed">
          {error instanceof Error ? error.message : "Something went wrong."}
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
          Import a current schema-v2 observation before editing DNS rewrites.
        </Banner>
      ) : (
        <>
          <UnsavedChangesNotice
            dirty={dirty}
            saving={saving}
            saved={saved}
            onSave={() => void saveDraft()}
          />
          <CapabilityWarning state={capability.state} title={capability.title}>
            {capability.message}
          </CapabilityWarning>
          {pendingRemovals.length > 0 && (
            <Banner
              tone="warning"
              title="Rewrite deletion pending in this draft"
            >
              {pendingRemovals
                .map((rewrite) => `${rewrite.domain} → ${rewrite.answer}`)
                .join(", ")}{" "}
              will remain on every node until this draft is saved, published,
              and deployed.
            </Banner>
          )}
          <SettingsGroup
            title="Rewrite policy and rollout"
            description="The global switch is revisioned desired state. Node convergence reflects the currently active revision, not unsaved browser edits."
          >
            <SettingRow
              title="Enable DNS rewrites"
              description={
                capability.supported
                  ? "Apply enabled legacy rewrite entries on every target node."
                  : "The imported value is retained because one or more target nodes lack the rewrite settings endpoint."
              }
              status={
                <StatusBadge
                  status={cluster.activeRevisionId ? "success" : "pending"}
                  label={
                    cluster.activeRevisionId
                      ? "Active revision present"
                      : "No active revision"
                  }
                />
              }
              control={
                <Switch
                  label="Enable DNS rewrites"
                  checked={draft.document.shared.rewritesEnabled}
                  disabled={!capability.supported}
                  onChange={setRewritesEnabled}
                />
              }
            />
            <div className="rewrite-convergence">
              <ConvergenceSummary counts={convergence.counts} />
            </div>
          </SettingsGroup>
          <div className="rewrite-table-toolbar">
            <label>
              Search rewrites
              <input
                type="search"
                value={search}
                placeholder="Domain or answer"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <p className="muted">
              {rows.length} of {rewrites.length} rewrites shown
            </p>
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={({ rewrite, index }) =>
              `${index}-${rewrite.domain}-${rewrite.answer}`
            }
            caption="DNS rewrites in the current desired-state draft"
            emptyTitle={
              rewrites.length === 0
                ? "No DNS rewrites"
                : "No rewrites match this search"
            }
            filteredEmpty={rewrites.length > 0}
            emptyDescription={
              rewrites.length === 0 ? (
                <>
                  <p>
                    Add a rewrite to define a cluster-wide A, AAAA, CNAME, or
                    supported passthrough answer.
                  </p>
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      setEditor({ mode: "add", rewrite: emptyRewrite() })
                    }
                  >
                    Add Rewrite
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </button>
              )
            }
          />
          {issues.length > 0 && (
            <Banner tone="warning" title="Validation needs attention">
              <ul className="compact-list">
                {issues.map((issue) => (
                  <li key={`${issue.field}-${issue.message}`}>
                    {issue.field}: {issue.message}
                  </li>
                ))}
              </ul>
            </Banner>
          )}
        </>
      )}

      {editor !== undefined && (
        <RewriteDialog
          editor={editor}
          rewrites={rewrites}
          toggleSupported={capability.supported}
          onClose={() => setEditor(undefined)}
          onSave={commitEditor}
        />
      )}
      <ConfirmDialog
        open={removeRewrite !== undefined}
        onClose={() => setRemoveIndex(undefined)}
        onConfirm={() => {
          if (removeIndex !== undefined)
            setRewrites(rewrites.filter((_, index) => index !== removeIndex));
          setRemoveIndex(undefined);
        }}
        title={`Delete ${removeRewrite?.domain ?? "rewrite"}?`}
        description="This updates the configuration draft only."
        confirmLabel="Delete from Draft"
      >
        <p>
          The rewrite will not be deleted from any AdGuard Home node until you
          save this draft, publish a revision, and deploy it.
        </p>
      </ConfirmDialog>
    </PageContainer>
  );
}

export function rewriteProposalFromSearch(
  search: string,
): RewriteEditor | undefined {
  const parameters = new URLSearchParams(search);
  const domain = parameters.get("domain")?.trim().toLowerCase() ?? "";
  if (
    parameters.get("action") !== "create" ||
    domain === "" ||
    domain.length > 253 ||
    /[^a-z0-9._-]/u.test(domain)
  )
    return undefined;
  return { mode: "add", rewrite: { ...emptyRewrite(), domain } };
}

function RewriteDialog({
  editor,
  rewrites,
  toggleSupported,
  onClose,
  onSave,
}: {
  editor: RewriteEditor;
  rewrites: Rewrite[];
  toggleSupported: boolean;
  onClose: () => void;
  onSave: (rewrite: Rewrite) => void;
}) {
  const [rewrite, setRewrite] = useState(editor.rewrite);
  const domainRef = useRef<HTMLInputElement>(null);
  const validation = validateRewrite(rewrite, rewrites, editor.index);
  const invalid = hasRewriteValidationErrors(validation);
  const inferredType = inferRewriteType(rewrite);
  const update = (patch: Partial<Rewrite>) =>
    setRewrite((current) => ({ ...current, ...patch }));

  return (
    <Dialog
      open
      onClose={onClose}
      title={editor.mode === "add" ? "Add DNS Rewrite" : "Edit DNS Rewrite"}
      description="Changes are staged in the browser until you save the cluster draft."
      initialFocusRef={domainRef}
      actions={
        <>
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button"
            disabled={invalid}
            onClick={() => onSave(rewrite)}
          >
            {editor.mode === "add" ? "Add to Draft" : "Update Draft"}
          </button>
        </>
      }
    >
      <div className="rewrite-dialog__fields">
        <Field
          label="Domain or wildcard"
          htmlFor="rewrite-domain"
          required
          error={validation.domain}
          help="Use an exact hostname such as router.example or one leading wildcard such as *.example. Schemes, paths, ports, trailing dots, and other wildcard positions are not supported."
        >
          <input
            ref={domainRef}
            id="rewrite-domain"
            value={rewrite.domain}
            autoComplete="off"
            placeholder="router.example or *.example"
            aria-invalid={validation.domain !== undefined}
            onChange={(event) => update({ domain: event.target.value })}
          />
        </Field>
        <Field
          label="Answer"
          htmlFor="rewrite-answer"
          required
          error={validation.answer ?? validation.duplicate}
          help="Use an IPv4 address (A), IPv6 address (AAAA), hostname (CNAME), or exact uppercase A or AAAA to pass that query type through to upstream. Other DNS record syntax is not supported here."
          scope={
            <StatusBadge
              status={inferredType === "Unknown" ? "warning" : "info"}
              label={inferredType}
            />
          }
        >
          <input
            id="rewrite-answer"
            value={rewrite.answer}
            autoComplete="off"
            placeholder="192.0.2.1 or target.example"
            aria-invalid={
              validation.answer !== undefined ||
              validation.duplicate !== undefined
            }
            onChange={(event) => update({ answer: event.target.value })}
          />
        </Field>
        <SettingRow
          title="Enable this rewrite"
          description={
            toggleSupported
              ? "Disabled entries remain in desired state but do not answer queries."
              : "This imported value is retained because an older target lacks per-entry rewrite enablement."
          }
          control={
            <Switch
              label="Enable this rewrite"
              checked={rewrite.enabled}
              disabled={!toggleSupported}
              onChange={(enabled) => update({ enabled })}
            />
          }
        />
      </div>
    </Dialog>
  );
}

function Switch({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function rewriteToggleCapability(
  nodes: readonly Node[],
  capabilities: readonly CapabilityProfile[],
): {
  supported: boolean;
  state: "supported" | "partial" | "unsupported";
  title?: string;
  message: string;
} {
  if (nodes.length === 0)
    return {
      supported: false,
      state: "partial",
      title: "No enabled rewrite targets",
      message:
        "Add or enable a compatible node before changing global or per-entry rewrite enablement.",
    };
  const byNode = new Map(
    capabilities.map((profile) => [profile.nodeId, profile]),
  );
  const unavailable = nodes.filter((node) => {
    const profile = byNode.get(node.id);
    return profile === undefined || !profile.features.rewrites;
  });
  if (unavailable.length > 0)
    return {
      supported: false,
      state: "partial",
      title: "Rewrite capability data is partial",
      message: `${unavailable.map((node) => node.name).join(", ")} cannot currently confirm the rewrite contract. Existing desired values are retained.`,
    };
  const older = nodes.filter(
    (node) => !byNode.get(node.id)?.features.rewrite_toggle,
  );
  if (older.length > 0)
    return {
      supported: false,
      state: "partial",
      title: "Rewrite enablement unavailable on older nodes",
      message: `${older.map((node) => node.name).join(", ")} lacks the rewrite settings endpoint. Keep the imported global and per-entry enabled values; publication preflight remains authoritative.`,
    };
  return {
    supported: true,
    state: "supported",
    message: "Every enabled node supports rewrite settings.",
  };
}

function convergencePresentation(nodes: readonly Node[]): {
  status: StatusKind;
  label: string;
  counts: {
    converged: number;
    pending: number;
    drifted: number;
    failed: number;
    maintenance: number;
  };
} {
  const counts = {
    converged: 0,
    pending: 0,
    drifted: 0,
    failed: 0,
    maintenance: 0,
  };
  let unsupported = 0;
  for (const node of nodes) {
    switch (node.convergenceStatus) {
      case "converged":
        counts.converged += 1;
        break;
      case "drifted":
        counts.drifted += 1;
        break;
      case "maintenance":
        counts.maintenance += 1;
        break;
      case "apply_failed":
      case "observation_failed":
        counts.failed += 1;
        break;
      case "unsupported":
        unsupported += 1;
        counts.failed += 1;
        break;
      default:
        counts.pending += 1;
    }
  }
  if (nodes.length === 0)
    return { status: "unknown", label: "No enabled nodes", counts };
  if (counts.failed > 0)
    return {
      status: unsupported > 0 ? "unsupported" : "failed",
      label:
        unsupported > 0
          ? `${unsupported} unsupported`
          : `${counts.failed} failed`,
      counts,
    };
  if (counts.drifted > 0)
    return {
      status: "drifted",
      label: `${counts.drifted} drifted`,
      counts,
    };
  if (counts.pending > 0)
    return {
      status: "pending",
      label: `${counts.pending} pending`,
      counts,
    };
  if (counts.maintenance > 0)
    return {
      status: "maintenance",
      label: `${counts.maintenance} in maintenance`,
      counts,
    };
  return {
    status: "converged",
    label: `${counts.converged}/${nodes.length} converged`,
    counts,
  };
}

function cloneRewrite(rewrite: Rewrite): Rewrite {
  return { ...rewrite };
}

function samePair(left: Rewrite, right: Rewrite) {
  return (
    left.domain.toLocaleLowerCase() === right.domain.toLocaleLowerCase() &&
    left.answer.toLocaleLowerCase() === right.answer.toLocaleLowerCase()
  );
}
