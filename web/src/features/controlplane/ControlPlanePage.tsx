import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { api } from "../../lib/api";
import type { Cluster, Deployment, DriftEvent, Node } from "../../lib/types";

export function ControlPlanePage({
  cluster,
  focus,
}: {
  cluster: Cluster;
  focus: "deployments" | "drift";
}) {
  const [deployments, setDeployments] = useState<Deployment[]>();
  const [drift, setDrift] = useState<DriftEvent[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [draftVersion, setDraftVersion] = useState(0);
  const [policy, setPolicy] = useState(cluster.reconciliationPolicy);
  const [clusterVersion, setClusterVersion] = useState(cluster.version);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState("");
  const deploymentHeading = useRef<HTMLHeadingElement>(null);
  const driftHeading = useRef<HTMLHeadingElement>(null);
  const lastFocusedRoute = useRef("");
  const nodeNames = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.name])),
    [nodes],
  );

  const load = useCallback(async () => {
    try {
      const [deploymentResult, driftResult, nodeResult, inventory] =
        await Promise.all([
          api.deployments(cluster.id),
          api.driftEvents(cluster.id),
          api.nodes(cluster.id),
          api.configurationInventory(cluster.id),
        ]);
      const detailed = await Promise.all(
        deploymentResult.items
          .slice(0, 20)
          .map((item) => api.deployment(item.id)),
      );
      setDeployments(detailed);
      setDrift(driftResult.items);
      setNodes(nodeResult.items);
      setDraftVersion(inventory.draft?.version ?? 0);
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

  useEffect(() => {
    const routeKey = `${cluster.id}:${focus}`;
    if (deployments === undefined || lastFocusedRoute.current === routeKey)
      return;
    lastFocusedRoute.current = routeKey;
    (focus === "deployments"
      ? deploymentHeading
      : driftHeading
    ).current?.focus();
  }, [cluster.id, deployments, focus]);

  async function updatePolicy(value: Cluster["reconciliationPolicy"]) {
    setBusy("policy");
    try {
      const updated = await api.updateCluster({
        ...cluster,
        version: clusterVersion,
        reconciliationPolicy: value,
      });
      setPolicy(updated.reconciliationPolicy);
      setClusterVersion(updated.version);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }

  async function driftAction(
    item: DriftEvent,
    action: "restore" | "adopt" | "maintenance",
  ) {
    setBusy(item.id);
    try {
      if (action === "restore") await api.restoreDrift(item.id);
      if (action === "adopt") await api.adoptDrift(item.id, draftVersion);
      if (action === "maintenance") {
        const node = nodes.find((candidate) => candidate.id === item.nodeId);
        if (node) await api.setNodeMaintenance(node, true);
      }
      await load();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }

  if (deployments === undefined && error === undefined)
    return <Loading label="Loading deployment control plane…" />;
  if (deployments === undefined)
    return <ErrorState error={error} retry={() => void load()} />;
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Convergence control</p>
          <h1>Deployments and drift</h1>
          <p className="muted">
            Durable sequential deployment, read-back verification, and
            policy-controlled reconciliation.
          </p>
        </div>
      </header>
      {error !== undefined && (
        <ErrorState error={error} retry={() => void load()} />
      )}
      <section className="section-block">
        <div className="section-heading">
          <h2>Reconciliation policy</h2>
          <small>Maintenance nodes are always excluded</small>
        </div>
        <div className="card form-stack">
          <label>
            Cluster policy
            <select
              value={policy}
              disabled={busy !== ""}
              onChange={(event) =>
                void updatePolicy(
                  event.target.value as Cluster["reconciliationPolicy"],
                )
              }
            >
              <option value="manual">Manual — operator chooses</option>
              <option value="alert">Alert — record without mutation</option>
              <option value="enforce">Enforce — automatically restore</option>
            </select>
          </label>
          <p className="muted">
            Automatic enforcement creates the same durable, verified deployment
            record as a manual restore.
          </p>
        </div>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2
            id="deployment-timeline"
            ref={deploymentHeading}
            tabIndex={focus === "deployments" ? -1 : undefined}
          >
            Deployment timeline
          </h2>
          <small>Newest first; refreshing every 3 seconds</small>
        </div>
        {deployments.length === 0 ? (
          <EmptyState title="No deployments">
            <p>Publish and deploy a configuration revision to begin.</p>
          </EmptyState>
        ) : (
          <div className="card-list">
            {deployments.map((deployment) => (
              <article className="card" key={deployment.id}>
                <div className="section-heading">
                  <h3>{deployment.origin} deployment</h3>
                  <span
                    className={`status status--${deployment.status === "succeeded" ? "healthy" : deployment.status.includes("failed") ? "unreachable" : "unknown"}`}
                  >
                    {deployment.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="muted">
                  Requested {new Date(deployment.requestedAt).toLocaleString()}{" "}
                  · request <code>{deployment.requestId}</code>
                </p>
                {deployment.errorCode && (
                  <div className="notice notice--warning">
                    {deployment.errorCode}
                  </div>
                )}
                <ol>
                  {deployment.nodes.map((task) => (
                    <li key={task.id}>
                      <div>
                        <strong>
                          {nodeNames.get(task.nodeId) ?? task.nodeId}
                        </strong>
                        : {task.status.replaceAll("_", " ")}
                        {task.errorCode ? ` — ${task.errorCode}` : ""}
                      </div>
                      {task.errorMessage && (
                        <p className="table-subtitle">{task.errorMessage}</p>
                      )}
                    </li>
                  ))}
                </ol>
                {["queued", "validating", "running"].includes(
                  deployment.status,
                ) && (
                  <button
                    className="button button--danger"
                    type="button"
                    disabled={busy !== ""}
                    onClick={() =>
                      void api
                        .cancelDeployment(deployment.id)
                        .then(load)
                        .catch(setError)
                    }
                  >
                    Cancel at safe boundary
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2
            id="drift-events"
            ref={driftHeading}
            tabIndex={focus === "drift" ? -1 : undefined}
          >
            Drift events
          </h2>
          <small>
            {drift.filter((item) => item.status === "open").length} open
          </small>
        </div>
        {drift.length === 0 ? (
          <EmptyState title="No drift detected">
            <p>
              Drift evaluation begins after a revision has successfully
              converged and become active.
            </p>
          </EmptyState>
        ) : (
          <div className="card-list">
            {drift.map((item) => (
              <article className="card" key={item.id}>
                <div className="section-heading">
                  <h3>{nodeNames.get(item.nodeId) ?? item.nodeId}</h3>
                  <span>
                    {item.status} · {item.policy}
                  </span>
                </div>
                <p>
                  Detected {new Date(item.detectedAt).toLocaleString()} ·{" "}
                  {item.reconciliationStatus}
                </p>
                <ul>
                  {item.differences.map((difference) => (
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
                {item.status === "open" && (
                  <div className="row-actions row-actions--start">
                    <button
                      type="button"
                      className="button"
                      disabled={busy !== ""}
                      onClick={() => void driftAction(item, "restore")}
                    >
                      Restore desired
                    </button>
                    <button
                      type="button"
                      className="button button--secondary"
                      disabled={busy !== "" || draftVersion === 0}
                      onClick={() => void driftAction(item, "adopt")}
                    >
                      Adopt into draft
                    </button>
                    <button
                      type="button"
                      className="button button--secondary"
                      disabled={busy !== ""}
                      onClick={() => void driftAction(item, "maintenance")}
                    >
                      Maintenance
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
