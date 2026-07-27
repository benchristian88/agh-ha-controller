import type { HealthStatus } from "../lib/types";

const labels: Record<HealthStatus | "empty" | "stale", string> = {
  healthy: "Healthy",
  unreachable: "Unreachable",
  incompatible: "Incompatible",
  disabled: "Disabled",
  unknown: "Unknown",
  empty: "No nodes",
  stale: "Stale",
};

export function StatusBadge({
  status,
}: {
  status: HealthStatus | "empty" | "stale";
}) {
  return <span className={`status status--${status}`}>{labels[status]}</span>;
}
