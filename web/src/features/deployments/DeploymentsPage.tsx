import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { PageHeader } from "../../components/Page";
import { StatusBadge, type StatusKind } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import type {
  Cluster,
  ConfigurationRevision,
  Deployment,
  Node,
} from "../../lib/types";

const activeStates = new Set(["queued", "validating", "running"]);

export function DeploymentsPage({ cluster }: { cluster: Cluster }) {
  const [deployments, setDeployments] = useState<Deployment[]>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [revisions, setRevisions] = useState<ConfigurationRevision[]>([]);
  const [selectedID, setSelectedID] = useState(
    () => new URLSearchParams(window.location.search).get("deploymentId") ?? "",
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<unknown>();

  const load = useCallback(async () => {
    try {
      const [deploymentResult, nodeResult, revisionResult] = await Promise.all([
        api.deployments(cluster.id),
        api.nodes(cluster.id),
        api.configurationRevisions(cluster.id),
      ]);
      const detailed = await Promise.all(
        deploymentResult.items
          .slice(0, 20)
          .map((item) => api.deployment(item.id)),
      );
      setDeployments(detailed);
      setNodes(nodeResult.items);
      setRevisions(revisionResult.items);
      setSelectedID((current) =>
        detailed.some((deployment) => deployment.id === current)
          ? current
          : detailed[0]?.id || "",
      );
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, [cluster.id]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load]);

  const nodeNames = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.name])),
    [nodes],
  );
  const revisionByID = useMemo(
    () => new Map(revisions.map((revision) => [revision.id, revision])),
    [revisions],
  );
  const active = deployments?.find((deployment) =>
    activeStates.has(deployment.status),
  );
  const selected = deployments?.find(
    (deployment) => deployment.id === selectedID,
  );

  async function cancel(deployment: Deployment) {
    if (
      !window.confirm(
        "Request cancellation at the next safe node boundary? The current node operation may finish first.",
      )
    )
      return;
    setBusy(deployment.id);
    try {
      await api.cancelDeployment(deployment.id);
      await load();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }

  if (deployments === undefined && error === undefined)
    return <Loading label="Loading deployments…" />;
  if (deployments === undefined)
    return <ErrorState error={error} retry={() => void load()} />;

  return (
    <>
      <PageHeader
        eyebrow="Execution events"
        title="Deployments"
        description="Track what was applied to each node and whether read-back verification completed successfully."
      />
      {error !== undefined && (
        <ErrorState error={error} retry={() => void load()} />
      )}

      {active !== undefined && (
        <section className="section-block" aria-label="Active deployment">
          <div className="section-heading">
            <h2>Active deployment</h2>
            <StatusBadge status={deploymentStatus(active.status)} />
          </div>
          <DeploymentCard
            deployment={active}
            revision={revisionByID.get(active.revisionId)}
            nodeNames={nodeNames}
            busy={busy}
            onCancel={cancel}
          />
        </section>
      )}

      <section className="section-block">
        <div className="section-heading">
          <h2>Deployment history</h2>
          <small>Newest first; refreshing every 3 seconds</small>
        </div>
        {deployments.length === 0 ? (
          <EmptyState title="No deployments">
            <p>
              Publish a revision in Configuration Control, then deploy it from
              Change History.
            </p>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Deployment</th>
                  <th>Revision</th>
                  <th>Summary</th>
                  <th>Started by</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Status</th>
                  <th>Nodes</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((deployment) => {
                  const revision = revisionByID.get(deployment.revisionId);
                  const succeeded = deployment.nodes.filter(
                    (node) => node.status === "succeeded",
                  ).length;
                  const failed = deployment.nodes.filter(
                    (node) => node.status === "failed",
                  ).length;
                  return (
                    <tr key={deployment.id}>
                      <td>
                        <code>{shortID(deployment.id)}</code>
                      </td>
                      <td>
                        {revision
                          ? `#${revision.revisionNumber}`
                          : shortID(deployment.revisionId)}
                      </td>
                      <td>{revision?.summary ?? deployment.origin}</td>
                      <td>
                        <code>
                          {shortID(deployment.requestedBy ?? "system")}
                        </code>
                      </td>
                      <td>
                        {formatTime(
                          deployment.startedAt ?? deployment.requestedAt,
                        )}
                      </td>
                      <td>{formatTime(deployment.completedAt)}</td>
                      <td>
                        <StatusBadge
                          status={deploymentStatus(deployment.status)}
                          label={deployment.status.replaceAll("_", " ")}
                        />
                      </td>
                      <td>
                        {succeeded} succeeded · {failed} failed
                      </td>
                      <td>
                        <button
                          className="button button--quiet"
                          type="button"
                          onClick={() => setSelectedID(deployment.id)}
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

      {selected !== undefined && selected.id !== active?.id && (
        <section className="section-block" id="deployment-detail">
          <div className="section-heading">
            <h2>Deployment detail</h2>
            <StatusBadge
              status={deploymentStatus(selected.status)}
              label={selected.status.replaceAll("_", " ")}
            />
          </div>
          <DeploymentCard
            deployment={selected}
            revision={revisionByID.get(selected.revisionId)}
            nodeNames={nodeNames}
            busy={busy}
            onCancel={cancel}
          />
        </section>
      )}
    </>
  );
}

function DeploymentCard({
  deployment,
  revision,
  nodeNames,
  busy,
  onCancel,
}: {
  deployment: Deployment;
  revision?: ConfigurationRevision;
  nodeNames: ReadonlyMap<string, string>;
  busy: string;
  onCancel: (deployment: Deployment) => Promise<void>;
}) {
  const complete = deployment.nodes.filter((node) =>
    ["succeeded", "failed", "skipped", "cancelled"].includes(node.status),
  ).length;
  const current = deployment.nodes.find(
    (node) =>
      !["succeeded", "failed", "skipped", "cancelled"].includes(node.status),
  );
  return (
    <article className="card form-stack">
      <div className="section-heading">
        <div>
          <h3>
            {revision
              ? `Revision #${revision.revisionNumber}`
              : `Revision ${shortID(deployment.revisionId)}`}
          </h3>
          <p className="muted">{revision?.summary ?? deployment.origin}</p>
        </div>
        <strong>
          {complete} of {deployment.nodes.length} node tasks complete
        </strong>
      </div>
      <progress max={Math.max(deployment.nodes.length, 1)} value={complete}>
        {complete} of {deployment.nodes.length}
      </progress>
      <dl className="summary-grid">
        <div>
          <dt>Deployment ID</dt>
          <dd>
            <code>{deployment.id}</code>
          </dd>
        </div>
        <div>
          <dt>Requested by</dt>
          <dd>
            <code>{deployment.requestedBy ?? "system"}</code>
          </dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>{formatTime(deployment.startedAt ?? deployment.requestedAt)}</dd>
        </div>
        <div>
          <dt>Current operation</dt>
          <dd>
            {current
              ? `${nodeNames.get(current.nodeId) ?? current.nodeId}: ${current.status.replaceAll("_", " ")}`
              : "No operation running"}
          </dd>
        </div>
        <div>
          <dt>Strategy</dt>
          <dd>Sequential · stop on failure</dd>
        </div>
        <div>
          <dt>Preflight</dt>
          <dd>Passed all-target validation before mutation</dd>
        </div>
        <div>
          <dt>Cancellation</dt>
          <dd>{deployment.cancelRequested ? "Requested" : "Not requested"}</dd>
        </div>
        <div>
          <dt>Request ID</dt>
          <dd>
            <code>{deployment.requestId}</code>
          </dd>
        </div>
      </dl>
      {deployment.errorCode && (
        <div className="notice notice--warning">
          <strong>{deployment.errorCode}</strong>
        </div>
      )}
      <ol className="progress-list">
        {deployment.nodes.map((task) => (
          <li key={task.id}>
            <div className="section-heading">
              <strong>
                {task.position}. {nodeNames.get(task.nodeId) ?? task.nodeId}
              </strong>
              <StatusBadge
                status={taskStatus(task.status)}
                label={task.status.replaceAll("_", " ")}
              />
            </div>
            <p className="muted">
              Attempts: {task.attemptCount} · Verification:{" "}
              {task.verificationSnapshotId ? "recorded" : "not recorded"}
            </p>
            {task.errorCode && (
              <p>
                <strong>{task.errorCode}</strong>
                {task.errorMessage ? ` — ${task.errorMessage}` : ""}
              </p>
            )}
          </li>
        ))}
      </ol>
      <div className="row-actions row-actions--start">
        {activeStates.has(deployment.status) && (
          <button
            className="button button--danger"
            type="button"
            disabled={busy !== ""}
            onClick={() => void onCancel(deployment)}
          >
            {busy === deployment.id ? "Requesting…" : "Cancel at safe boundary"}
          </button>
        )}
        <a
          className="button button--secondary"
          href={`/ha/history#revision-detail`}
        >
          View revision
        </a>
        {deployment.status === "failed" && (
          <a className="button button--secondary" href="/ha/drift">
            View resulting drift
          </a>
        )}
      </div>
    </article>
  );
}

function deploymentStatus(status: string): StatusKind {
  if (status === "succeeded") return "success";
  if (status.includes("failed")) return "failed";
  if (status.includes("cancel")) return "warning";
  return "applying";
}

function taskStatus(status: string): StatusKind {
  if (status === "succeeded") return "success";
  if (status === "failed") return "failed";
  if (status === "verifying") return "verifying";
  if (status === "running") return "applying";
  return "pending";
}

function shortID(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}
function formatTime(value?: string): string {
  return value ? new Date(value).toLocaleString() : "—";
}
