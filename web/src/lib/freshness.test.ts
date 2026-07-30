import { describe, expect, it } from "vitest";
import { clusterHealth, isStale } from "./freshness";
import type { Node } from "./types";

const baseNode: Node = {
  id: "1",
  clusterId: "2",
  name: "node",
  baseUrl: "https://node.test",
  certificatePolicy: "system",
  enabled: true,
  healthStatus: "healthy",
  compatibilityStatus: "supported",
  maintenanceMode: false,
  convergenceStatus: "converged",
  recordVersion: 1,
  createdAt: "2026-07-27T00:00:00Z",
  updatedAt: "2026-07-27T00:00:00Z",
};

describe("dashboard freshness", () => {
  it("treats missing and old poll times as stale", () => {
    expect(isStale(undefined, 100_000)).toBe(true);
    expect(isStale("1970-01-01T00:00:10Z", 100_000, 20_000)).toBe(true);
    expect(isStale("1970-01-01T00:01:30Z", 100_000, 20_000)).toBe(false);
  });

  it("does not present partial failure as healthy", () => {
    expect(clusterHealth([])).toBe("empty");
    expect(clusterHealth([baseNode])).toBe("healthy");
    expect(
      clusterHealth([
        baseNode,
        { ...baseNode, id: "3", healthStatus: "unreachable" },
      ]),
    ).toBe("unknown");
  });
});
