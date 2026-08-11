import { useCallback, useEffect, useState } from "react";
import { MetricCard } from "../../components/DataDisplay";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { clusterHealth, isStale } from "../../lib/freshness";
import type {
  Cluster,
  Node,
  OperationalStatus,
  StatisticsReport,
} from "../../lib/types";
import { useScope } from "../../shell/ScopeContext";

export function DashboardPage({ cluster }: { cluster: Cluster }) {
  const { nodeId: scopeNodeId } = useScope();
  const [nodes, setNodes] = useState<Node[]>();
  const [refreshedAt, setRefreshedAt] = useState<string>();
  const [staleAfterMs, setStaleAfterMs] = useState(90_000);
  const [error, setError] = useState<unknown>();
  const [statistics, setStatistics] = useState<StatisticsReport>();
  const [operational, setOperational] = useState<OperationalStatus>();

  const load = useCallback(async () => {
    try {
      const [result, statisticsResult, operationalResult] = await Promise.all([
        api.nodes(cluster.id),
        api.statistics(cluster.id, "24h", scopeNodeId).catch(() => undefined),
        api.operationalStatus(cluster.id).catch(() => undefined),
      ]);
      setNodes(result.items);
      setRefreshedAt(result.refreshedAt);
      setStaleAfterMs(result.staleAfterSeconds * 1000);
      setError(undefined);
      setStatistics(statisticsResult);
      setOperational(operationalResult);
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
        <MetricCard label="Managed nodes" value={String(currentNodes.length)} />
        <MetricCard
          label="Healthy nodes"
          value={`${healthy} / ${currentNodes.length}`}
        />
        <MetricCard label="Stale nodes" value={String(stale)} />
        <MetricCard label="Controller role" value="Management only" />
      </section>
      {(operational !== undefined ||
        (statistics !== undefined && statistics.state !== "unavailable")) && (
        <section
          className="dashboard-summary-grid"
          aria-label="Controller and DNS overview"
        >
          {operational !== undefined && (
            <article className="card dashboard-summary-card">
              <header className="dashboard-summary-card__header">
                <div>
                  <p className="eyebrow">Controller operations</p>
                  <h2>HA and controller health</h2>
                </div>
                <StatusBadge status={operational.summary.state} />
              </header>
              <p className="dashboard-summary-card__description">
                {operational.summary.message}
              </p>
              <dl className="dashboard-summary-card__metrics">
                <div>
                  <dt>API</dt>
                  <dd className="operational-value">{operational.api}</dd>
                </div>
                <div>
                  <dt>HA redundancy</dt>
                  <dd className="operational-value">{operational.ha.state}</dd>
                </div>
                <div>
                  <dt>DNS service</dt>
                  <dd className="operational-value">
                    {operational.ha.servingDnsNodes} /{" "}
                    {operational.ha.totalNodes}
                  </dd>
                </div>
                <div>
                  <dt>Statistics</dt>
                  <dd className="operational-value">
                    {operational.statistics.state}
                  </dd>
                </div>
                <div>
                  <dt>Query log</dt>
                  <dd className="operational-value">
                    {operational.queryLog.state}
                  </dd>
                </div>
              </dl>
              <footer className="dashboard-summary-card__footer">
                <a
                  className="button button--secondary"
                  href="/system/operational-status"
                >
                  View operational status
                </a>
                <a className="button button--secondary" href="/ha/operations">
                  Open HA operations
                </a>
              </footer>
            </article>
          )}
          {statistics !== undefined && statistics.state !== "unavailable" && (
            <article className="card dashboard-summary-card">
              <header className="dashboard-summary-card__header">
                <div>
                  <p className="eyebrow">Last 24 hours</p>
                  <h2>DNS activity</h2>
                </div>
                <StatusBadge
                  status={statistics.state === "ready" ? "healthy" : "degraded"}
                />
              </header>
              <p className="dashboard-summary-card__description">
                Aggregated DNS traffic across the nodes in the current scope.
              </p>
              <dl className="dashboard-summary-card__metrics">
                <div>
                  <dt>Queries</dt>
                  <dd>
                    {new Intl.NumberFormat().format(
                      statistics.totals.dnsQueries,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Blocked</dt>
                  <dd>
                    {statistics.totals.blockedPercentage.toLocaleString(
                      undefined,
                      { maximumFractionDigits: 2 },
                    )}
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
              <footer className="dashboard-summary-card__footer">
                <a className="button button--secondary" href="/statistics">
                  View statistics
                </a>
              </footer>
            </article>
          )}
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
