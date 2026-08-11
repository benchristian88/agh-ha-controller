import { useCallback, useEffect, useState } from "react";
import { MetricCard, SummaryTileGrid } from "../../components/DataDisplay";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { PageHeader } from "../../components/Page";
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
  const [statisticsLoading, setStatisticsLoading] = useState(true);
  const [operationalLoading, setOperationalLoading] = useState(true);
  const [statisticsError, setStatisticsError] = useState<unknown>();
  const [operationalError, setOperationalError] = useState<unknown>();

  const load = useCallback(async () => {
    void api
      .statistics(cluster.id, "24h", scopeNodeId)
      .then((result) => {
        setStatistics(result);
        setStatisticsError(undefined);
      })
      .catch((caught: unknown) => setStatisticsError(caught))
      .finally(() => setStatisticsLoading(false));
    void api
      .operationalStatus(cluster.id)
      .then((result) => {
        setOperational(result);
        setOperationalError(undefined);
      })
      .catch((caught: unknown) => setOperationalError(caught))
      .finally(() => setOperationalLoading(false));

    try {
      const result = await api.nodes(cluster.id);
      setNodes(result.items);
      setRefreshedAt(result.refreshedAt);
      setStaleAfterMs(result.staleAfterSeconds * 1000);
      setError(undefined);
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
      <PageHeader
        eyebrow="Overview"
        title={cluster.name}
        primaryAction={<StatusBadge status={clusterHealth(currentNodes)} />}
      />
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
      <section
        className="dashboard-summary-grid"
        aria-label="Controller and DNS overview"
      >
        <article className="card dashboard-summary-card">
          <header className="dashboard-summary-card__header">
            <div>
              <p className="eyebrow">Controller operations</p>
              <h2>Controller health</h2>
            </div>
            <StatusBadge
              status={operational?.summary.state ?? "unknown"}
              label={operationalLoading ? "Loading" : undefined}
            />
          </header>
          <p className="dashboard-summary-card__description">
            {operationalDescription(
              operational,
              operationalLoading,
              operationalError,
            )}
          </p>
          <SummaryTileGrid
            className="dashboard-summary-card__metrics"
            items={[
              {
                id: "api",
                label: "API",
                value: operationalValue(operational?.api, operationalLoading),
                valueClassName: "operational-value",
              },
              {
                id: "ha-redundancy",
                label: "HA redundancy",
                value: operationalValue(
                  operational?.ha.state,
                  operationalLoading,
                ),
                valueClassName: "operational-value",
              },
              {
                id: "statistics",
                label: "Statistics",
                value: operationalValue(
                  operational?.statistics.state,
                  operationalLoading,
                ),
                valueClassName: "operational-value",
              },
              {
                id: "query-log",
                label: "Query Log",
                value: operationalValue(
                  operational?.queryLog.state,
                  operationalLoading,
                ),
                valueClassName: "operational-value",
              },
            ]}
          />
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
        <article className="card dashboard-summary-card">
          <header className="dashboard-summary-card__header">
            <div>
              <p className="eyebrow">Last 24 hours</p>
              <h2>DNS activity</h2>
            </div>
            <StatisticsStatus
              statistics={statistics}
              loading={statisticsLoading}
            />
          </header>
          <p className="dashboard-summary-card__description">
            {statisticsDescription(
              statistics,
              statisticsLoading,
              statisticsError,
            )}
          </p>
          <SummaryTileGrid
            className="dashboard-summary-card__metrics"
            items={[
              {
                id: "queries",
                label: "Queries",
                value: statisticsValue(
                  statistics,
                  statisticsLoading,
                  (report) => formatCount(report.totals.dnsQueries),
                ),
              },
              {
                id: "blocked",
                label: "Blocked",
                value: statisticsValue(
                  statistics,
                  statisticsLoading,
                  (report) =>
                    `${formatNumber(report.totals.blockedPercentage)}%`,
                ),
              },
              {
                id: "safety-interventions",
                label: "Safety interventions",
                value: statisticsValue(
                  statistics,
                  statisticsLoading,
                  (report) => formatCount(report.totals.safetyInterventions),
                ),
              },
              {
                id: "average-processing",
                label: "Average processing",
                value: statisticsValue(
                  statistics,
                  statisticsLoading,
                  (report) =>
                    `${formatNumber(report.totals.averageProcessingMs)} ms`,
                ),
              },
            ]}
          />
          <footer className="dashboard-summary-card__footer">
            <a className="button button--secondary" href="/statistics">
              View statistics
            </a>
          </footer>
        </article>
      </section>
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

function StatisticsStatus({
  statistics,
  loading,
}: {
  statistics?: StatisticsReport;
  loading: boolean;
}) {
  if (loading) return <StatusBadge status="unknown" label="Loading" />;
  if (statistics === undefined || statistics.state === "unavailable")
    return <StatusBadge status="unknown" label="Unavailable" />;
  return (
    <StatusBadge
      status={statistics.state === "ready" ? "healthy" : "degraded"}
    />
  );
}

function operationalDescription(
  operational: OperationalStatus | undefined,
  loading: boolean,
  error: unknown,
) {
  if (loading) return "Checking controller subsystem health.";
  if (operational === undefined)
    return "Controller subsystem health is temporarily unavailable.";
  if (error !== undefined)
    return "Refresh failed. Showing the last available subsystem health.";
  return operational.summary.message;
}

function statisticsDescription(
  statistics: StatisticsReport | undefined,
  loading: boolean,
  error: unknown,
) {
  if (loading) return "Loading aggregated DNS activity for the current scope.";
  if (statistics === undefined)
    return "DNS activity is temporarily unavailable for the current scope.";
  if (error !== undefined)
    return "Refresh failed. Showing the last available DNS activity.";
  if (statistics.state === "unavailable")
    return "No usable 24-hour Statistics snapshot is available for the current scope.";
  if (statistics.state === "partial")
    return "Partial 24-hour DNS activity from the nodes currently reporting in this scope.";
  return "Aggregated 24-hour DNS activity across the nodes in the current scope.";
}

function operationalValue(value: string | undefined, loading: boolean) {
  if (loading) return "Loading…";
  return value?.replaceAll("_", " ") ?? "Unavailable";
}

function statisticsValue(
  statistics: StatisticsReport | undefined,
  loading: boolean,
  render: (report: StatisticsReport) => string,
) {
  if (loading) return "Loading…";
  if (statistics === undefined || statistics.state === "unavailable")
    return "—";
  return render(statistics);
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
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
