import { useCallback, useEffect, useMemo, useState } from "react";
import { StructuredDiff } from "../../components/DataDisplay";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { PageHeader } from "../../components/Page";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import type {
  Cluster,
  ConfigurationDifference,
  DriftEvent,
  Node,
} from "../../lib/types";

export function DriftPage({ cluster }: { cluster: Cluster }) {
  const [drift, setDrift] = useState<DriftEvent[]>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [draftVersion, setDraftVersion] = useState(0);
  const [policy, setPolicy] = useState(cluster.reconciliationPolicy);
  const [clusterVersion, setClusterVersion] = useState(cluster.version);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<unknown>();

  const load = useCallback(async () => {
    try {
      const [driftResult, nodeResult, inventory] = await Promise.all([
        api.driftEvents(cluster.id),
        api.nodes(cluster.id),
        api.configurationInventory(cluster.id),
      ]);
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
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const nodeByID = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const counts = useMemo(
    () => ({
      converged: nodes.filter(
        (node) =>
          node.convergenceStatus === "converged" && !node.maintenanceMode,
      ).length,
      drifted: nodes.filter(
        (node) => node.convergenceStatus === "drifted" && !node.maintenanceMode,
      ).length,
      unavailable: nodes.filter((node) => node.healthStatus === "unreachable")
        .length,
      maintenance: nodes.filter((node) => node.maintenanceMode).length,
      unknown: nodes.filter(
        (node) =>
          ["pending", "observation_failed", "unsupported"].includes(
            node.convergenceStatus,
          ) && !node.maintenanceMode,
      ).length,
    }),
    [nodes],
  );

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

  async function restore(item: DriftEvent) {
    if (
      !window.confirm(
        "Restore the active desired revision through a new durable, sequential, verified deployment?",
      )
    )
      return;
    setBusy(item.id);
    try {
      await api.restoreDrift(item.id);
      await load();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }

  async function adopt(item: DriftEvent) {
    if (
      !window.confirm(
        "Adopt this observed configuration into the mutable draft only? You must still review, validate, publish, and deploy it.",
      )
    )
      return;
    setBusy(item.id);
    try {
      await api.adoptDrift(item.id, draftVersion);
      window.location.assign("/ha/configuration#advanced-adoption");
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }

  async function maintenance(item: DriftEvent) {
    const node = nodeByID.get(item.nodeId);
    if (!node) return;
    if (
      !node.maintenanceMode &&
      !window.confirm(
        `Put ${node.name} into maintenance? Deployments and reconciliation will exclude it.`,
      )
    )
      return;
    setBusy(item.id);
    try {
      await api.setNodeMaintenance(node, !node.maintenanceMode);
      await load();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy("");
    }
  }

  if (drift === undefined && error === undefined)
    return <Loading label="Loading convergence state…" />;
  if (drift === undefined)
    return <ErrorState error={error} retry={() => void load()} />;
  const open = drift.filter((item) => item.status === "open");

  return (
    <>
      <PageHeader
        eyebrow="Current convergence"
        title="Drift"
        description="Identify nodes that no longer match the active revision and choose a deliberate restore, adoption, or maintenance response."
      />
      {error !== undefined && (
        <ErrorState error={error} retry={() => void load()} />
      )}
      <section
        className="section-block convergence-summary"
        aria-label="Cluster convergence summary"
      >
        <div>
          <StatusBadge status={open.length > 0 ? "drifted" : "converged"} />
          <strong>
            {open.length > 0
              ? `${open.length} open drift incidents`
              : "Cluster has no open drift incidents"}
          </strong>
        </div>
        <dl>
          <div>
            <dt>Converged nodes</dt>
            <dd>{counts.converged}</dd>
          </div>
          <div>
            <dt>Drifted nodes</dt>
            <dd>{counts.drifted}</dd>
          </div>
          <div>
            <dt>Unavailable nodes</dt>
            <dd>{counts.unavailable}</dd>
          </div>
          <div>
            <dt>Maintenance nodes</dt>
            <dd>{counts.maintenance}</dd>
          </div>
          <div>
            <dt>Unknown nodes</dt>
            <dd>{counts.unknown}</dd>
          </div>
        </dl>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Drift incidents</h2>
          <small>
            {open.length} open · {drift.length - open.length} resolved
          </small>
        </div>
        {drift.length === 0 ? (
          <EmptyState title="No drift detected">
            <p>
              Drift evaluation begins after a revision has fully verified and
              become active.
            </p>
          </EmptyState>
        ) : (
          <div className="card-list">
            {drift.map((item) => {
              const node = nodeByID.get(item.nodeId);
              return (
                <article className="card form-stack" key={item.id}>
                  <div className="section-heading">
                    <div>
                      <h3>{node?.name ?? item.nodeId}</h3>
                      <p className="muted">
                        First detected{" "}
                        {new Date(item.detectedAt).toLocaleString()} · last
                        observed {new Date(item.lastSeenAt).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge
                      status={item.status === "open" ? "drifted" : "converged"}
                      label={`${item.status} · ${item.policy}`}
                    />
                  </div>
                  {node?.maintenanceMode && (
                    <div className="notice notice--warning">
                      This node is in maintenance and excluded from automatic
                      mutation.
                    </div>
                  )}
                  <StructuredDiff
                    differences={toStructured(item.differences)}
                    beforeLabel="Desired"
                    afterLabel="Observed"
                  />
                  <dl className="summary-grid">
                    <div>
                      <dt>Reconciliation</dt>
                      <dd>{item.reconciliationStatus.replaceAll("_", " ")}</dd>
                    </div>
                    <div>
                      <dt>Desired revision</dt>
                      <dd>
                        <code>{item.desiredRevisionId}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Desired identifier</dt>
                      <dd>
                        <code>{item.desiredHash.slice(0, 12)}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Observed identifier</dt>
                      <dd>
                        <code>{item.observedHash.slice(0, 12)}</code>
                      </dd>
                    </div>
                  </dl>
                  <div className="row-actions row-actions--start">
                    {item.status === "open" && (
                      <>
                        <button
                          className="button"
                          type="button"
                          disabled={busy !== "" || node?.maintenanceMode}
                          onClick={() => void restore(item)}
                        >
                          Restore desired state
                        </button>
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={busy !== "" || draftVersion === 0}
                          onClick={() => void adopt(item)}
                        >
                          Adopt into draft
                        </button>
                      </>
                    )}
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={busy !== "" || node === undefined}
                      onClick={() => void maintenance(item)}
                    >
                      {node?.maintenanceMode
                        ? "Exit maintenance"
                        : "Enter maintenance"}
                    </button>
                    <a className="button button--quiet" href="/ha/nodes">
                      View node
                    </a>
                    <a
                      className="button button--quiet"
                      href={`/ha/history?revisionId=${encodeURIComponent(item.desiredRevisionId)}#revision-detail`}
                    >
                      View active revision
                    </a>
                    {item.relatedDeploymentId && (
                      <a
                        className="button button--quiet"
                        href={`/ha/deployments?deploymentId=${encodeURIComponent(item.relatedDeploymentId)}#deployment-detail`}
                      >
                        View deployment {item.relatedDeploymentId.slice(0, 8)}…
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="section-block">
        <details className="card">
          <summary>
            <strong>Drift policy</strong> · {policy}
          </summary>
          <div className="form-stack">
            <p className="muted">
              Policy is cluster-wide. Maintenance nodes are always excluded.
            </p>
            <label>
              Reconciliation policy
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
          </div>
        </details>
      </section>
    </>
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
