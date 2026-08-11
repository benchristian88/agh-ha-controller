// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import type {
  Cluster,
  Node,
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

const nodes = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Primary",
    baseUrl: "https://primary.example.test",
    healthStatus: "healthy",
    compatibilityStatus: "supported",
    lastPolledAt: "2099-08-11T00:00:00Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Secondary",
    baseUrl: "https://secondary.example.test",
    healthStatus: "unreachable",
    compatibilityStatus: "supported",
    lastPolledAt: "2099-08-11T00:00:00Z",
  },
] as Node[];

const operational = {
  summary: {
    state: "degraded",
    message: "One or more controller subsystems require attention.",
  },
  api: "healthy",
  ha: {
    state: "at_risk",
    servingDnsNodes: 1,
    totalNodes: 2,
  },
  statistics: { state: "stale" },
  queryLog: { state: "healthy" },
} as OperationalStatus;

const statistics = {
  state: "partial",
  totals: {
    dnsQueries: 1200,
    blockedPercentage: 12.5,
    safetyInterventions: 17,
    averageProcessingMs: 16.25,
  },
  coverage: { includedNodes: 1, expectedNodes: 2 },
} as StatisticsReport;

function renderDashboard() {
  return render(
    <ScopeProvider value={{ nodeId: "", nodes }}>
      <DashboardPage cluster={cluster} />
    </ScopeProvider>,
  );
}

describe("DashboardPage", () => {
  it("presents one node-health count and symmetrical controller and DNS summaries", async () => {
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: nodes,
      refreshedAt: "2026-08-11T00:00:00Z",
      staleAfterSeconds: 90,
    });
    vi.spyOn(api, "operationalStatus").mockResolvedValue(operational);
    vi.spyOn(api, "statistics").mockResolvedValue(statistics);

    const { container } = renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Controller health" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "DNS activity" })).toBeTruthy();
    expect(
      screen.getByText("Managed nodes").nextElementSibling?.textContent,
    ).toBe("2");
    expect(
      screen.getByText("Healthy nodes").nextElementSibling?.textContent,
    ).toBe("1 / 2");
    expect(
      screen.getByText("Stale nodes").nextElementSibling?.textContent,
    ).toBe("0");
    expect(
      screen.getByText("Controller role").nextElementSibling?.textContent,
    ).toBe("Management only");

    const panels = container.querySelectorAll(
      ".dashboard-summary-grid > .dashboard-summary-card",
    );
    expect(panels).toHaveLength(2);
    const controllerPanel = panels.item(0) as HTMLElement;
    const dnsPanel = panels.item(1) as HTMLElement;
    const controllerMetrics = controllerPanel.querySelectorAll(
      ".dashboard-summary-card__metrics > div",
    );
    const dnsMetrics = dnsPanel.querySelectorAll(
      ".dashboard-summary-card__metrics > div",
    );
    expect(controllerMetrics).toHaveLength(4);
    expect(dnsMetrics).toHaveLength(4);
    expect(within(controllerPanel).getByText("API")).toBeTruthy();
    expect(within(controllerPanel).getByText("HA redundancy")).toBeTruthy();
    expect(within(controllerPanel).getByText("Statistics")).toBeTruthy();
    expect(within(controllerPanel).getByText("Query Log")).toBeTruthy();
    expect(within(controllerPanel).queryByText("DNS service")).toBeNull();

    expect(within(dnsPanel).getByText("Queries")).toBeTruthy();
    expect(within(dnsPanel).getByText("1,200")).toBeTruthy();
    expect(within(dnsPanel).getByText("Blocked")).toBeTruthy();
    expect(within(dnsPanel).getByText("12.5%")).toBeTruthy();
    expect(within(dnsPanel).getByText("Safety interventions")).toBeTruthy();
    expect(within(dnsPanel).getByText("17")).toBeTruthy();
    expect(within(dnsPanel).getByText("Average processing")).toBeTruthy();
    expect(within(dnsPanel).getByText("16.25 ms")).toBeTruthy();
    expect(within(dnsPanel).queryByText("Coverage")).toBeNull();
    expect(
      container
        .querySelector(".node-card__top > .status")
        ?.getAttribute("data-size"),
    ).toBe("compact");
    expect(
      Array.from(container.querySelectorAll(".status")).every(
        (badge) => badge.getAttribute("data-size") === "compact",
      ),
    ).toBe(true);

    const accessibility = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    expect(accessibility.violations).toEqual([]);
  });

  it("keeps both summaries visible when supplementary APIs are unavailable", async () => {
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: nodes,
      refreshedAt: "2026-08-11T00:00:00Z",
      staleAfterSeconds: 90,
    });
    vi.spyOn(api, "operationalStatus").mockRejectedValue(
      new Error("operational unavailable"),
    );
    vi.spyOn(api, "statistics").mockRejectedValue(
      new Error("statistics unavailable"),
    );

    const { container } = renderDashboard();

    expect(
      await screen.findByText(
        "Controller subsystem health is temporarily unavailable.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "DNS activity is temporarily unavailable for the current scope.",
      ),
    ).toBeTruthy();
    expect(
      container.querySelectorAll(".dashboard-summary-card__metrics > div"),
    ).toHaveLength(8);
    const dnsPanel = screen
      .getByRole("heading", { name: "DNS activity" })
      .closest("article");
    expect(within(dnsPanel as HTMLElement).getAllByText("—")).toHaveLength(4);
  });

  it("does not present unavailable statistics totals as zero", async () => {
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: nodes,
      refreshedAt: "2026-08-11T00:00:00Z",
      staleAfterSeconds: 90,
    });
    vi.spyOn(api, "operationalStatus").mockResolvedValue(operational);
    vi.spyOn(api, "statistics").mockResolvedValue({
      ...statistics,
      state: "unavailable",
    });

    renderDashboard();

    expect(
      await screen.findByText(
        "No usable 24-hour Statistics snapshot is available for the current scope.",
      ),
    ).toBeTruthy();
    const dnsPanel = screen
      .getByRole("heading", { name: "DNS activity" })
      .closest("article");
    expect(within(dnsPanel as HTMLElement).getAllByText("—")).toHaveLength(4);
    expect(
      screen.getByText("Unavailable", { selector: ".status" }),
    ).toBeTruthy();
  });

  it("labels every supplementary metric while its source is loading", async () => {
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: nodes,
      refreshedAt: "2026-08-11T00:00:00Z",
      staleAfterSeconds: 90,
    });
    vi.spyOn(api, "operationalStatus").mockReturnValue(
      new Promise<OperationalStatus>(() => undefined),
    );
    vi.spyOn(api, "statistics").mockReturnValue(
      new Promise<StatisticsReport>(() => undefined),
    );

    renderDashboard();

    expect(await screen.findByText("Managed nodes")).toBeTruthy();
    expect(screen.getAllByText("Loading…")).toHaveLength(8);
    expect(
      screen.getAllByText("Loading", { selector: ".status" }),
    ).toHaveLength(2);
  });
});
