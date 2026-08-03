import { useCallback, useEffect, useMemo, useState } from "react";
import { RevisionBadge, StructuredDiff } from "../../components/DataDisplay";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { PageHeader } from "../../components/Page";
import { api } from "../../lib/api";
import type {
  Cluster,
  ConfigurationDifference,
  ConfigurationRevision,
  Deployment,
} from "../../lib/types";

export function HistoryPage({ cluster }: { cluster: Cluster }) {
  const [revisions, setRevisions] = useState<ConfigurationRevision[]>();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedID, setSelectedID] = useState(
    () => new URLSearchParams(window.location.search).get("revisionId") ?? "",
  );
  const [leftID, setLeftID] = useState("");
  const [rightID, setRightID] = useState("");
  const [differences, setDifferences] = useState<ConfigurationDifference[]>();
  const [detailDifferences, setDetailDifferences] =
    useState<ConfigurationDifference[]>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<unknown>();

  const load = useCallback(async () => {
    try {
      const [revisionResult, deploymentResult] = await Promise.all([
        api.configurationRevisions(cluster.id),
        api.deployments(cluster.id),
      ]);
      setRevisions(revisionResult.items);
      setDeployments(deploymentResult.items);
      setSelectedID((current) =>
        revisionResult.items.some((revision) => revision.id === current)
          ? current
          : revisionResult.items[0]?.id || "",
      );
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, [cluster.id]);

  useEffect(() => void load(), [load]);

  const selected = revisions?.find((revision) => revision.id === selectedID);
  const preceding = selected
    ? revisions?.find(
        (revision) => revision.revisionNumber === selected.revisionNumber - 1,
      )
    : undefined;
  const deploymentsByRevision = useMemo(() => {
    const result = new Map<string, Deployment[]>();
    for (const deployment of deployments) {
      const items = result.get(deployment.revisionId) ?? [];
      items.push(deployment);
      result.set(deployment.revisionId, items);
    }
    return result;
  }, [deployments]);

  useEffect(() => {
    if (!selected || !preceding) {
      setDetailDifferences(undefined);
      return;
    }
    let current = true;
    void api
      .compareConfigurationRevisions(preceding.id, selected.id)
      .then((result) => {
        if (current) setDetailDifferences(result.differences);
      })
      .catch((caught) => {
        if (current) setError(caught);
      });
    return () => {
      current = false;
    };
  }, [preceding, selected]);

  async function compare() {
    if (!leftID || !rightID) return;
    setBusy("compare");
    try {
      const result = await api.compareConfigurationRevisions(leftID, rightID);
      setDifferences(result.differences);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }

  async function deploy(revision: ConfigurationRevision) {
    setBusy(revision.id);
    try {
      const preview = await api.deploymentPreview(cluster.id, revision.id);
      if (!preview.valid) {
        throw new Error(
          preview.issues.map((issue) => issue.message).join("; ") ||
            "This revision is not ready to deploy.",
        );
      }
      const rollback = Boolean(cluster.activeRevisionId) && !revision.active;
      if (
        !window.confirm(
          `Deploy immutable revision #${revision.revisionNumber} to ${preview.nodes.length} nodes? This creates a new sequential, verified ${rollback ? "rollback " : ""}deployment and does not modify the revision.`,
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

  if (revisions === undefined && error === undefined)
    return <Loading label="Loading change history…" />;
  if (revisions === undefined)
    return <ErrorState error={error} retry={() => void load()} />;

  return (
    <>
      <PageHeader
        eyebrow="Immutable configuration"
        title="Change History"
        description="Review what changed over time, compare immutable revisions, and deploy a historical revision without modifying it."
      />
      {error !== undefined && (
        <ErrorState error={error} retry={() => void load()} />
      )}
      <section className="section-block">
        <div className="section-heading">
          <h2>Revision history</h2>
          <small>{revisions.length} published</small>
        </div>
        {revisions.length === 0 ? (
          <EmptyState title="No published revisions">
            <p>
              Validate and publish the current draft from Configuration Control.
            </p>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Revision</th>
                  <th>Summary</th>
                  <th>Published by</th>
                  <th>Published</th>
                  <th>Deployment</th>
                  <th>Identifier</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((revision) => {
                  const revisionDeployments =
                    deploymentsByRevision.get(revision.id) ?? [];
                  return (
                    <tr key={revision.id}>
                      <td>
                        <RevisionBadge
                          number={revision.revisionNumber}
                          active={revision.active}
                        />
                      </td>
                      <td>{revision.summary}</td>
                      <td>
                        <code>{shortID(revision.createdBy)}</code>
                      </td>
                      <td>{new Date(revision.createdAt).toLocaleString()}</td>
                      <td>
                        {revisionDeployments[0]?.status.replaceAll("_", " ") ??
                          "Not deployed"}
                      </td>
                      <td>
                        <code>{revision.canonicalHash.slice(0, 12)}</code>
                      </td>
                      <td>
                        <button
                          className="button button--quiet"
                          type="button"
                          onClick={() => setSelectedID(revision.id)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected !== undefined && (
        <section className="section-block" id="revision-detail">
          <div className="section-heading">
            <h2>Revision #{selected.revisionNumber}</h2>
            <RevisionBadge
              number={selected.revisionNumber}
              active={selected.active}
            />
          </div>
          <article className="card form-stack">
            <dl className="summary-grid">
              <div>
                <dt>Operator summary</dt>
                <dd>{selected.summary}</dd>
              </div>
              <div>
                <dt>Published by</dt>
                <dd>
                  <code>{selected.createdBy}</code>
                </dd>
              </div>
              <div>
                <dt>Published at</dt>
                <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Schema</dt>
                <dd>Version {selected.schemaVersion}</dd>
              </div>
              <div>
                <dt>Publication validation</dt>
                <dd>Passed whole-draft and capability validation</dd>
              </div>
              <div>
                <dt>Configuration hash</dt>
                <dd>
                  <code>{selected.canonicalHash}</code>
                </dd>
              </div>
              <div>
                <dt>Deployments</dt>
                <dd>{(deploymentsByRevision.get(selected.id) ?? []).length}</dd>
              </div>
            </dl>
            {(deploymentsByRevision.get(selected.id) ?? []).length > 0 && (
              <ul>
                {(deploymentsByRevision.get(selected.id) ?? []).map(
                  (deployment) => (
                    <li key={deployment.id}>
                      <a
                        href={`/ha/deployments?deploymentId=${encodeURIComponent(deployment.id)}#deployment-detail`}
                      >
                        {shortID(deployment.id)} ·{" "}
                        {deployment.status.replaceAll("_", " ")}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            )}
            {preceding !== undefined && detailDifferences !== undefined && (
              <div>
                <h3>Changed since revision #{preceding.revisionNumber}</h3>
                <StructuredDiff
                  differences={toStructured(detailDifferences)}
                  beforeLabel={`Revision #${preceding.revisionNumber}`}
                  afterLabel={`Revision #${selected.revisionNumber}`}
                />
              </div>
            )}
            <div className="row-actions row-actions--start">
              <button
                className="button"
                type="button"
                disabled={busy !== ""}
                onClick={() => void deploy(selected)}
              >
                {busy === selected.id ? "Preparing…" : "Deploy this revision"}
              </button>
              <a className="button button--secondary" href="/ha/deployments">
                View deployments
              </a>
            </div>
            <details>
              <summary>Advanced immutable snapshot</summary>
              <pre className="technical-output">
                <code>{JSON.stringify(selected.document, null, 2)}</code>
              </pre>
            </details>
          </article>
        </section>
      )}

      {revisions.length > 1 && (
        <section className="section-block">
          <div className="section-heading">
            <h2>Compare revisions</h2>
            <small>Structured semantic comparison</small>
          </div>
          <div className="card form-stack">
            <div className="form-grid">
              <RevisionSelect
                label="Earlier revision"
                value={leftID}
                revisions={revisions}
                onChange={setLeftID}
              />
              <RevisionSelect
                label="Later revision"
                value={rightID}
                revisions={revisions}
                onChange={setRightID}
              />
            </div>
            <button
              className="button button--secondary"
              type="button"
              disabled={busy !== "" || !leftID || !rightID}
              onClick={() => void compare()}
            >
              {busy === "compare" ? "Comparing…" : "Compare revisions"}
            </button>
            {differences !== undefined && (
              <StructuredDiff
                differences={toStructured(differences)}
                beforeLabel="Earlier"
                afterLabel="Later"
              />
            )}
          </div>
        </section>
      )}
    </>
  );
}

function RevisionSelect({
  label,
  value,
  revisions,
  onChange,
}: {
  label: string;
  value: string;
  revisions: ConfigurationRevision[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select…</option>
        {revisions.map((revision) => (
          <option key={revision.id} value={revision.id}>
            #{revision.revisionNumber} — {revision.summary}
          </option>
        ))}
      </select>
    </label>
  );
}

function toStructured(differences: ConfigurationDifference[]) {
  return differences.map((difference, index) => ({
    id: `${difference.section}-${difference.field}-${index}`,
    section: difference.section,
    field: difference.field,
    before: difference.left,
    after: difference.right,
    summary: difference.summary,
  }));
}

function shortID(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}
