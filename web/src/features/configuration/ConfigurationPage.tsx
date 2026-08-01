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
import { buildDraftSummary } from "./draftSummary";

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
        `Import the reviewed snapshot from ${nodeNames.get(snapshot.nodeId) ?? "this node"} into the cluster draft? This replaces the draft's shared values with this snapshot and updates this node's listener override. It does not publish, deploy, or change any node.`,
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
      setIssues([]);
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
  const activeRevision = revisions.find(
    (revision) => revision.active || revision.id === cluster.activeRevisionId,
  );
  const draftSections = draft
    ? buildDraftSummary(draft.document, activeRevision?.document, nodeNames)
    : [];
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Authoritative configuration</p>
          <h1>Configuration Control</h1>
          <p className="muted">
            Review the complete cluster draft, validate it, publish an immutable
            revision, and control safe deployment. Author routine settings on
            their canonical pages.
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
            <h2>Draft and change summary</h2>
            <small>
              Schema {draft.document.schemaVersion} · optimistic draft version{" "}
              {draft.version}
            </small>
          </div>
          <p className="muted">
            {activeRevision
              ? `Change markers compare this draft with active revision #${activeRevision.revisionNumber}.`
              : "No active revision exists yet; every section is marked unpublished."}
          </p>
          <div className="configuration-summary-grid">
            {draftSections.map((section) => (
              <details className="card configuration-summary" key={section.id}>
                <summary>
                  <span>
                    <strong>{section.title}</strong>
                    <small>{section.description}</small>
                  </span>
                  <span
                    className={`change-state change-state--${section.change}`}
                  >
                    {section.change === "changed"
                      ? "Changed"
                      : section.change === "unchanged"
                        ? "Matches active"
                        : "Unpublished"}
                  </span>
                </summary>
                <dl>
                  {section.items.map((item) => (
                    <div key={`${section.id}-${item.label}`}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <a className="summary-link" href={section.href}>
                  {section.id === "unsupported"
                    ? "Review observations"
                    : `Open ${section.title}`}
                </a>
              </details>
            ))}
          </div>
          <div className="card form-stack configuration-actions">
            <div className="row-actions row-actions--start">
              <button
                className="button"
                type="button"
                disabled={busy !== ""}
                onClick={() => void validateDraft()}
              >
                {busy === "validate-draft" ? "Validating…" : "Validate draft"}
              </button>
              <a className="button button--secondary" href="/settings/dns">
                Continue authoring
              </a>
            </div>
            {issues.length > 0 && (
              <div className="notice notice--warning">
                <strong>Validation needs attention</strong>
                <ul>
                  {issues.map((issue) => (
                    <li key={`${issue.field}-${issue.message}`}>
                      {formatValidationIssue(issue, nodeNames)}
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
      <section className="section-block" id="observations">
        <div className="section-heading">
          <h2>Nodes and capabilities</h2>
          <small>Schema-v2 capability profiles and observations</small>
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

export function formatValidationIssue(
  issue: ValidationIssue,
  nodeNames: ReadonlyMap<string, string>,
): string {
  const match = /^nodeOverrides\.([^.]+)(?:\.(.+))?$/.exec(issue.field);
  if (!match) return `${issue.field}: ${issue.message}`;

  const nodeID = match[1];
  if (nodeID === undefined) return `${issue.field}: ${issue.message}`;
  const nodeName = nodeNames.get(nodeID) ?? nodeID;
  const field = match[2];
  if (
    field === undefined &&
    issue.message === "is required for every enabled node"
  ) {
    return `${nodeName}: listener override is missing. Refresh and import this node's latest successful snapshot, then review the shared draft again.`;
  }
  if (field === "dnsPort" && issue.message === "must be between 1 and 65535") {
    return `${nodeName}: DNS port is missing or invalid. Refresh and import this node's latest successful snapshot, then review the shared draft again.`;
  }
  if (field?.startsWith("bindHosts")) {
    return `${nodeName}: DNS bind addresses are missing or invalid. Refresh and import this node's latest successful snapshot, then review the shared draft again.`;
  }
  return `${nodeName}: ${issue.message}`;
}

function formatValue(value: unknown): string {
  const text = JSON.stringify(value);
  return text === undefined ? "—" : text;
}
