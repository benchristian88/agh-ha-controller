// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import type {
  Cluster,
  OperationalStatus,
  StatisticsReport,
} from "../../lib/types";
import { ScopeProvider } from "../../shell/ScopeContext";
import { DashboardPage } from "./DashboardPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const cluster = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Home",
} as Cluster;

describe("DashboardPage", () => {
  it("groups controller operations and DNS activity in the shared summary grid", async () => {
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [],
      refreshedAt: "2026-08-09T00:00:00Z",
      staleAfterSeconds: 90,
    });
    vi.spyOn(api, "operationalStatus").mockResolvedValue({
      summary: { state: "healthy", message: "All systems operational." },
      api: "healthy",
      ha: {
        state: "healthy",
        servingDnsNodes: 2,
        totalNodes: 2,
      },
      statistics: { state: "healthy" },
      queryLog: { state: "healthy" },
    } as OperationalStatus);
    vi.spyOn(api, "statistics").mockResolvedValue({
      state: "ready",
      totals: { dnsQueries: 1200, blockedPercentage: 12.5 },
      coverage: { includedNodes: 2, expectedNodes: 2 },
    } as StatisticsReport);

    const { container } = render(
      <ScopeProvider value={{ nodeId: "", nodes: [] }}>
        <DashboardPage cluster={cluster} />
      </ScopeProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "HA and controller health" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "DNS activity" })).toBeTruthy();
    const summaryGrid = container.querySelector(".dashboard-summary-grid");
    expect(summaryGrid).not.toBeNull();
    expect(summaryGrid?.querySelectorAll(":scope > article")).toHaveLength(2);
  });
});
