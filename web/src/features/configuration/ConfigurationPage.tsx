import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { api } from "../../lib/api";
import type {
  CapabilityProfile,
  Cluster,
  ConfigurationDifference,
  ConfigurationDraft,
  ConfigurationSnapshot,
  Node,
} from "../../lib/types";

export function ConfigurationPage({ cluster }: { cluster: Cluster }) {
  const [nodes, setNodes] = useState<Node[]>();
  const [snapshots, setSnapshots] = useState<ConfigurationSnapshot[]>();
  const [capabilities, setCapabilities] = useState<CapabilityProfile[]>([]);
  const [draft, setDraft] = useState<ConfigurationDraft>();
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
      const [nodeResult, inventory] = await Promise.all([
        api.nodes(cluster.id),
        api.configurationInventory(cluster.id),
      ]);
      setNodes(nodeResult.items);
      setSnapshots(inventory.snapshots);
      setCapabilities(inventory.capabilities);
      setDraft(inventory.draft);
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
          <p className="eyebrow">Configuration inventory</p>
          <h1>Compare node configuration</h1>
          <p className="muted">
            Read-only schema v1 inventory. Observation and import never change
            AdGuard Home.
          </p>
        </div>
      </header>
      {error !== undefined && (
        <ErrorState error={error} retry={() => void load()} />
      )}
      {draft !== undefined && (
        <div className="notice notice--info">
          <strong>Inventory draft v{draft.version}</strong>
          <br />
          Imported {new Date(draft.updatedAt).toLocaleString()}. It is not an
          active revision and cannot be deployed in release 0.2.
        </div>
      )}
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

function formatValue(value: unknown): string {
  const text = JSON.stringify(value);
  return text === undefined ? "—" : text;
}
