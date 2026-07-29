import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { api } from "../../lib/api";
import type {
  CapabilityProfile,
  Cluster,
  ConfigurationDifference,
  ConfigurationDraft,
  ConfigurationRevision,
  ConfigurationSnapshot,
  Node,
  ValidationIssue,
} from "../../lib/types";

export function ConfigurationPage({ cluster }: { cluster: Cluster }) {
  const [nodes, setNodes] = useState<Node[]>();
  const [snapshots, setSnapshots] = useState<ConfigurationSnapshot[]>();
  const [capabilities, setCapabilities] = useState<CapabilityProfile[]>([]);
  const [draft, setDraft] = useState<ConfigurationDraft>();
  const [revisions, setRevisions] = useState<ConfigurationRevision[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [summary, setSummary] = useState("");
  const [revisionLeft, setRevisionLeft] = useState("");
  const [revisionRight, setRevisionRight] = useState("");
  const [revisionDifferences, setRevisionDifferences] =
    useState<ConfigurationDifference[]>();
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [differences, setDifferences] = useState<ConfigurationDifference[]>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState("");
  const nodeNames = useMemo(
    () => new Map((nodes ?? []).map((node) => [node.id, node.name])),
    [nodes],
  );

  const load = useCallback(async () => {
    try {
      const [nodeResult, inventory, revisionResult] = await Promise.all([
        api.nodes(cluster.id),
        api.configurationInventory(cluster.id),
        api.configurationRevisions(cluster.id),
      ]);
      setNodes(nodeResult.items);
      setSnapshots(inventory.snapshots);
      setCapabilities(inventory.capabilities);
      setDraft(normaliseDraft(inventory.draft));
      setRevisions(revisionResult.items);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, [cluster.id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function observe(node: Node) {
    setBusy(node.id);
    try {
      await api.observeNode(node.id);
      await load();
    } catch (caught) {
      setError(caught);
      await load();
    } finally {
      setBusy("");
    }
  }
  async function saveDraft() {
    if (!draft) return;
    setBusy("save-draft");
    try {
      const result = await api.updateConfigurationDraft(
        cluster.id,
        draft.version,
        draft.document,
      );
      setDraft(result.draft);
      setIssues(result.issues);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }
  async function validateDraft() {
    setBusy("validate-draft");
    try {
      const result = await api.validateConfigurationDraft(cluster.id);
      setIssues(result.issues);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }
  async function publishDraft() {
    if (!draft || !summary.trim()) return;
    setBusy("publish");
    try {
      await api.publishConfigurationRevision(
        cluster.id,
        draft.version,
        summary,
      );
      setSummary("");
      await load();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }
  async function deployRevision(
    revision: ConfigurationRevision,
    rollback: boolean,
  ) {
    const action = rollback ? "roll back to" : "deploy";
    setBusy(revision.id);
    try {
      const preview = await api.deploymentPreview(cluster.id, revision.id);
      setIssues(preview.issues);
      if (!preview.valid) return;
      const changed =
        preview.differences.length === 0
          ? "no semantic changes"
          : `${preview.differences.length} semantic changes`;
      if (
        !window.confirm(
          `${action} revision ${revision.revisionNumber} (${changed}) to ${preview.nodes.length} nodes using sequential stop-on-failure deployment? Every target is revalidated before the first node changes.`,
        )
      )
        return;
      if (rollback) await api.rollback(cluster.id, revision.id);
      else await api.startDeployment(cluster.id, revision.id);
      window.location.assign("/ha/deployments");
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }
  async function compareRevisions() {
    if (!revisionLeft || !revisionRight) return;
    setBusy("compare-revisions");
    try {
      const result = await api.compareConfigurationRevisions(
        revisionLeft,
        revisionRight,
      );
      setRevisionDifferences(result.differences);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }
  async function compare() {
    if (!left || !right) return;
    setBusy("compare");
    try {
      const result = await api.compareConfigurations(left, right);
      setDifferences(result.differences);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }
  async function importSnapshot(snapshot: ConfigurationSnapshot) {
    if (
      !window.confirm(
        `Import the reviewed snapshot from ${nodeNames.get(snapshot.nodeId) ?? "this node"} into the cluster draft? This does not publish, deploy, or change any node.`,
      )
    )
      return;
    setBusy(snapshot.id);
    try {
      setDraft(
        await api.importConfiguration(
          cluster.id,
          snapshot.id,
          draft?.version ?? 0,
        ),
      );
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }

  if (nodes === undefined && error === undefined)
    return <Loading label="Loading configuration inventory…" />;
  if (nodes === undefined)
    return <ErrorState error={error} retry={() => void load()} />;
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Authoritative configuration</p>
          <h1>Draft, publish, and deploy</h1>
          <p className="muted">
            Schema v1 manages shared DNS and filtering through immutable
            revisions. Node listener identities remain explicit overrides.
          </p>
        </div>
      </header>
      {error !== undefined && (
        <ErrorState error={error} retry={() => void load()} />
      )}
      {draft != null && (
        <div className="notice notice--info">
          <strong>Mutable draft v{draft.version}</strong>
          <br />
          Last saved {new Date(draft.updatedAt).toLocaleString()}. Saving does
          not change a node; publishing creates an immutable revision.
        </div>
      )}
      {draft && (
        <section className="section-block">
          <div className="section-heading">
            <h2>Shared desired state</h2>
            <small>Optimistic draft version {draft.version}</small>
          </div>
          <div className="card form-stack">
            <label className="checkbox">
              Upstream DNS
              <textarea
                rows={4}
                value={draft.document.shared.dns.upstreamDns.join("\n")}
                onChange={(event) =>
                  setDraft(
                    updateLines(draft, "upstreamDns", event.target.value),
                  )
                }
              />
            </label>
            <label>
              Bootstrap DNS
              <textarea
                rows={3}
                value={draft.document.shared.dns.bootstrapDns.join("\n")}
                onChange={(event) =>
                  setDraft(
                    updateLines(draft, "bootstrapDns", event.target.value),
                  )
                }
              />
            </label>
            <label>
              Fallback DNS
              <textarea
                rows={3}
                value={draft.document.shared.dns.fallbackDns.join("\n")}
                onChange={(event) =>
                  setDraft(
                    updateLines(draft, "fallbackDns", event.target.value),
                  )
                }
              />
            </label>
            <label>
              Private reverse DNS
              <textarea
                rows={3}
                value={draft.document.shared.dns.privateReverseDns.join("\n")}
                onChange={(event) =>
                  setDraft(
                    updateLines(draft, "privateReverseDns", event.target.value),
                  )
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.document.shared.filtering.enabled}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    document: {
                      ...draft.document,
                      shared: {
                        ...draft.document.shared,
                        filtering: {
                          ...draft.document.shared.filtering,
                          enabled: event.target.checked,
                        },
                      },
                    },
                  })
                }
              />{" "}
              Filtering enabled
            </label>
            <label>
              Filter update interval (hours)
              <input
                type="number"
                value={draft.document.shared.filtering.updateIntervalHours}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    document: {
                      ...draft.document,
                      shared: {
                        ...draft.document.shared,
                        filtering: {
                          ...draft.document.shared.filtering,
                          updateIntervalHours: Number(event.target.value),
                        },
                      },
                    },
                  })
                }
              />
            </label>
            <label>
              Filter subscription URLs
              <textarea
                rows={4}
                value={draft.document.shared.filtering.filterUrls.join("\n")}
                onChange={(event) =>
                  setDraft(
                    updateFilteringLines(
                      draft,
                      "filterUrls",
                      event.target.value,
                    ),
                  )
                }
              />
            </label>
            <label>
              Custom filtering rules
              <textarea
                rows={5}
                value={draft.document.shared.filtering.userRules.join("\n")}
                onChange={(event) =>
                  setDraft(
                    updateFilteringLines(
                      draft,
                      "userRules",
                      event.target.value,
                    ),
                  )
                }
              />
            </label>
            <div className="row-actions row-actions--start">
              <button
                className="button"
                type="button"
                disabled={busy !== ""}
                onClick={() => void saveDraft()}
              >
                {busy === "save-draft" ? "Saving…" : "Save draft"}
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={busy !== ""}
                onClick={() => void validateDraft()}
              >
                Validate
              </button>
            </div>
            {issues.length > 0 && (
              <div className="notice notice--warning">
                <strong>Validation needs attention</strong>
                <ul>
                  {issues.map((issue) => (
                    <li key={`${issue.field}-${issue.message}`}>
                      <code>{issue.field}</code>: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <label>
              Revision summary
              <input
                maxLength={500}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </label>
            <button
              className="button"
              type="button"
              disabled={busy !== "" || !summary.trim()}
              onClick={() => void publishDraft()}
            >
              {busy === "publish"
                ? "Publishing…"
                : "Publish immutable revision"}
            </button>
          </div>
        </section>
      )}
      <section className="section-block">
        <div className="section-heading">
          <h2>Revision history</h2>
          <small>{revisions.length} published</small>
        </div>
        {revisions.length === 0 ? (
          <EmptyState title="No published revisions">
            <p>
              Import a node snapshot to create a draft, then validate and
              publish it.
            </p>
          </EmptyState>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Revision</th>
                    <th>Summary</th>
                    <th>Published</th>
                    <th>State</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.map((revision) => (
                    <tr key={revision.id}>
                      <td>#{revision.revisionNumber}</td>
                      <td>{revision.summary}</td>
                      <td>{new Date(revision.createdAt).toLocaleString()}</td>
                      <td>{revision.active ? "Active" : "Historical"}</td>
                      <td>
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={busy !== ""}
                          onClick={() =>
                            void deployRevision(
                              revision,
                              Boolean(cluster.activeRevisionId) &&
                                !revision.active,
                            )
                          }
                        >
                          {cluster.activeRevisionId && !revision.active
                            ? "Rollback"
                            : "Deploy"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card form-stack">
              <div className="form-grid">
                <label>
                  Earlier revision
                  <select
                    value={revisionLeft}
                    onChange={(event) => setRevisionLeft(event.target.value)}
                  >
                    <option value="">Select…</option>
                    {revisions.map((revision) => (
                      <option key={revision.id} value={revision.id}>
                        #{revision.revisionNumber} — {revision.summary}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Later revision
                  <select
                    value={revisionRight}
                    onChange={(event) => setRevisionRight(event.target.value)}
                  >
                    <option value="">Select…</option>
                    {revisions.map((revision) => (
                      <option key={revision.id} value={revision.id}>
                        #{revision.revisionNumber} — {revision.summary}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="button button--secondary"
                type="button"
                disabled={busy !== "" || !revisionLeft || !revisionRight}
                onClick={() => void compareRevisions()}
              >
                Compare revisions
              </button>
              {revisionDifferences !== undefined &&
                (revisionDifferences.length === 0 ? (
                  <div className="notice notice--success">
                    These revisions are semantically equal.
                  </div>
                ) : (
                  <ul>
                    {revisionDifferences.map((difference) => (
                      <li
                        key={`${difference.section}-${difference.field}-${JSON.stringify(difference.left)}-${JSON.stringify(difference.right)}`}
                      >
                        <strong>
                          {difference.section} / {difference.field}
                        </strong>
                        : {difference.summary}
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </>
        )}
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2>Nodes and capabilities</h2>
          <small>DNS and filtering are supported in schema v1</small>
        </div>
        {nodes.length === 0 ? (
          <EmptyState title="No nodes">
            <p>Add a node before collecting configuration.</p>
          </EmptyState>
        ) : (
          <div className="node-grid">
            {nodes.map((node) => {
              const capability = capabilities.find(
                (item) => item.nodeId === node.id,
              );
              const snapshot = snapshots?.find(
                (item) => item.nodeId === node.id,
              );
              return (
                <article className="card" key={node.id}>
                  <div className="node-card__top">
                    <div>
                      <h3>{node.name}</h3>
                      <p className="muted">
                        {node.version ?? "Version unknown"}
                      </p>
                    </div>
                    <button
                      className="button button--quiet"
                      type="button"
                      disabled={busy !== "" || !node.enabled}
                      onClick={() => void observe(node)}
                    >
                      {busy === node.id ? "Reading…" : "Refresh"}
                    </button>
                  </div>
                  <p>
                    {snapshot
                      ? `Last observation: ${snapshot.collectionStatus}`
                      : "Not observed"}
                  </p>
                  {snapshot?.errorCode && (
                    <p className="error-code">{snapshot.errorCode}</p>
                  )}
                  <div className="capability-list">
                    <span>
                      DNS: {capability?.features.dns ? "supported" : "unknown"}
                    </span>
                    <span>
                      Filtering:{" "}
                      {capability?.features.filtering ? "supported" : "unknown"}
                    </span>
                  </div>
                  {capability?.warnings.map((warning) => (
                    <div className="notice notice--warning" key={warning}>
                      {warning}
                    </div>
                  ))}
                </article>
              );
            })}
          </div>
        )}
      </section>
      {(snapshots?.filter((item) => item.collectionStatus === "succeeded")
        .length ?? 0) > 0 && (
        <section className="section-block">
          <h2>Compare snapshots</h2>
          <div className="card form-stack">
            <div className="form-grid">
              <label>
                Left snapshot
                <select value={left} onChange={(e) => setLeft(e.target.value)}>
                  <option value="">Select…</option>
                  {snapshots
                    ?.filter((s) => s.document)
                    .map((s) => (
                      <option value={s.id} key={s.id}>
                        {nodeNames.get(s.nodeId)} —{" "}
                        {new Date(s.observedAt).toLocaleString()}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Right snapshot
                <select
                  value={right}
                  onChange={(e) => setRight(e.target.value)}
                >
                  <option value="">Select…</option>
                  {snapshots
                    ?.filter((s) => s.document)
                    .map((s) => (
                      <option value={s.id} key={s.id}>
                        {nodeNames.get(s.nodeId)} —{" "}
                        {new Date(s.observedAt).toLocaleString()}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <button
              className="button"
              type="button"
              disabled={!left || !right || busy !== ""}
              onClick={() => void compare()}
            >
              Compare
            </button>
          </div>
          {differences !== undefined &&
            (differences.length === 0 ? (
              <div className="notice notice--success">
                The supported configuration is semantically equal.
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Field</th>
                      <th>Scope</th>
                      <th>Left</th>
                      <th>Right</th>
                    </tr>
                  </thead>
                  <tbody>
                    {differences.map((diff) => (
                      <tr key={`${diff.section}-${diff.field}-${diff.scope}`}>
                        <td>{diff.section}</td>
                        <td>{diff.field}</td>
                        <td>{diff.scope.replaceAll("_", " ")}</td>
                        <td>
                          <code>{formatValue(diff.left)}</code>
                        </td>
                        <td>
                          <code>{formatValue(diff.right)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </section>
      )}
      <section className="section-block">
        <h2>Import into draft</h2>
        <p className="muted">
          Review a successful snapshot above, then explicitly import it. Import
          replaces only the mutable inventory draft.
        </p>
        <div className="row-actions row-actions--start">
          {snapshots
            ?.filter((s) => s.document)
            .map((snapshot) => (
              <button
                type="button"
                className="button button--secondary"
                disabled={busy !== ""}
                key={snapshot.id}
                onClick={() => void importSnapshot(snapshot)}
              >
                Import {nodeNames.get(snapshot.nodeId)}
              </button>
            ))}
        </div>
      </section>
    </>
  );
}

export function normaliseDraft(
  draft: ConfigurationDraft | null | undefined,
): ConfigurationDraft | undefined {
  return draft ?? undefined;
}

function formatValue(value: unknown): string {
  const text = JSON.stringify(value);
  return text === undefined ? "—" : text;
}

type DNSListField =
  | "upstreamDns"
  | "bootstrapDns"
  | "fallbackDns"
  | "privateReverseDns";
type FilteringListField = "filterUrls" | "userRules";

function nonEmptyLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function updateLines(
  draft: ConfigurationDraft,
  field: DNSListField,
  value: string,
): ConfigurationDraft {
  return {
    ...draft,
    document: {
      ...draft.document,
      shared: {
        ...draft.document.shared,
        dns: { ...draft.document.shared.dns, [field]: nonEmptyLines(value) },
      },
    },
  };
}

function updateFilteringLines(
  draft: ConfigurationDraft,
  field: FilteringListField,
  value: string,
): ConfigurationDraft {
  return {
    ...draft,
    document: {
      ...draft.document,
      shared: {
        ...draft.document.shared,
        filtering: {
          ...draft.document.shared.filtering,
          [field]: nonEmptyLines(value),
        },
      },
    },
  };
}
