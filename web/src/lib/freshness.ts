import type { HealthStatus, Node } from "./types";

export function isStale(
  lastPolledAt: string | undefined,
  now = Date.now(),
  thresholdMs = 90_000,
): boolean {
  if (lastPolledAt === undefined) return true;
  const value = Date.parse(lastPolledAt);
  return Number.isNaN(value) || now - value > thresholdMs;
}

export function clusterHealth(nodes: Node[]): HealthStatus | "empty" {
  if (nodes.length === 0) return "empty";
  if (nodes.every((node) => node.healthStatus === "healthy")) return "healthy";
  if (
    nodes.every(
      (node) =>
        node.healthStatus === "unreachable" || node.healthStatus === "disabled",
    )
  )
    return "unreachable";
  return "unknown";
}
