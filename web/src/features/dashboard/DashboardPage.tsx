import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { clusterHealth, isStale } from "../../lib/freshness";
import type { Cluster, Node, StatisticsReport } from "../../lib/types";
import { useScope } from "../../shell/ScopeContext";

export function DashboardPage({ cluster }: { cluster: Cluster }) {
  const { nodeId: scopeNodeId } = useScope();
  const [nodes, setNodes] = useState<Node[]>();
  const [refreshedAt, setRefreshedAt] = useState<string>();
  const [staleAfterMs, setStaleAfterMs] = useState(90_000);
  const [error, setError] = useState<unknown>();
  const [statistics, setStatistics] = useState<StatisticsReport>();

  const load = useCallback(async () => {
    try {
      const [result, statisticsResult] = await Promise.all([
        api.nodes(cluster.id),
        api.statistics(cluster.id, "24h", scopeNodeId).catch(() => undefined),
      ]);
      setNodes(result.items);
      setRefreshedAt(result.refreshedAt);
      setStaleAfterMs(result.staleAfterSeconds * 1000);
      setError(undefined);
      setStatistics(statisticsResult);
    } catch (caught) {
      setError(caught);
    }
  }, [cluster.id, scopeNodeId]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  if (nodes === undefined && error === undefined)
    return <Loading label="Loading cluster health…" />;
  if (nodes === undefined && error !== undefined)
    return <ErrorState error={error} retry={() => void load()} />;
  const currentNodes = nodes ?? [];
  const healthy = currentNodes.filter(
    (node) => node.healthStatus === "healthy",
  ).length;
  const stale = currentNodes.filter((node) =>
    isStale(node.lastPolledAt, Date.now(), staleAfterMs),
  ).length;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>{cluster.name}</h1>
        </div>
        <StatusBadge status={clusterHealth(currentNodes)} />
      </header>
      {error !== undefined && (
        <div className="notice notice--warning">
          Health refresh failed. Showing the last available data.
        </div>
      )}
      <section className="metrics" aria-label="Cluster health metrics">
        <Metric label="Managed nodes" value={String(currentNodes.length)} />
        <Metric
          label="Healthy nodes"
          value={`${healthy} / ${currentNodes.length}`}
        />
        <Metric label="Stale nodes" value={String(stale)} />
        <Metric label="Controller role" value="Management only" />
      </section>
      {statistics !== undefined && statistics.state !== "unavailable" && (
        <section className="card dashboard-statistics">
          <div>
            <p className="eyebrow">Last 24 hours</p>
            <h2>DNS activity</h2>
          </div>
          <dl>
            <div>
              <dt>Queries</dt>
              <dd>
                {new Intl.NumberFormat().format(statistics.totals.dnsQueries)}
              </dd>
            </div>
            <div>
              <dt>Blocked</dt>
              <dd>
                {statistics.totals.blockedPercentage.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
                %
              </dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd>
                {statistics.coverage.includedNodes} /{" "}
                {statistics.coverage.expectedNodes} nodes
              </dd>
            </div>
          </dl>
          <a className="button button--secondary" href="/statistics">
            View statistics
          </a>
        </section>
      )}
      {currentNodes.length === 0 ? (
        <EmptyState title="Add your first AdGuard Home node">
          <p>
            No charts are shown until health data exists. The controller will
            inspect status and version without changing DNS configuration.
          </p>
          <a className="button" href="/ha/nodes">
            Add a node
          </a>
        </EmptyState>
      ) : (
        <section className="section-block">
          <div className="section-heading">
            <h2>Node health</h2>
            {refreshedAt !== undefined && (
              <small>API view refreshed {formatTime(refreshedAt)}</small>
            )}
          </div>
          <div className="node-grid">
            {currentNodes.map((node) => (
              <NodeCard key={node.id} node={node} staleAfterMs={staleAfterMs} />
            ))}
          </div>
        </section>
      )}
      <section className="card independence-card">
        <div>
          <p className="eyebrow">Availability boundary</p>
          <h2>DNS stays on the nodes</h2>
        </div>
        <p>
          The controller is not in the live DNS request path. Stopping it pauses
          management and health refreshes; it does not stop AdGuard Home.
        </p>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function NodeCard({
  node,
  staleAfterMs,
}: {
  node: Node;
  staleAfterMs: number;
}) {
  const stale = isStale(node.lastPolledAt, Date.now(), staleAfterMs);
  return (
    <article className="card node-card">
      <div className="node-card__top">
        <div>
          <h3>{node.name}</h3>
          <span className="muted monospace">{node.baseUrl}</span>
        </div>
        <StatusBadge status={stale ? "stale" : node.healthStatus} />
      </div>
      <dl className="detail-list">
        <div>
          <dt>Version</dt>
          <dd>{node.version ?? "Not observed"}</dd>
        </div>
        <div>
          <dt>Compatibility</dt>
          <dd>{node.compatibilityStatus}</dd>
        </div>
        <div>
          <dt>Latency</dt>
          <dd>{node.latencyMs !== undefined ? `${node.latencyMs} ms` : "—"}</dd>
        </div>
        <div>
          <dt>Last seen</dt>
          <dd>{formatTime(node.lastSeenAt)}</dd>
        </div>
      </dl>
      {node.lastErrorCode !== undefined && node.lastErrorCode !== "" && (
        <p className="error-code">{node.lastErrorCode}</p>
      )}
    </article>
  );
}

function formatTime(value?: string): string {
  if (value === undefined) return "Never";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "Unknown" : parsed.toLocaleString();
}
