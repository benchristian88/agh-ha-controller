// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import type { Cluster } from "../../lib/types";
import { SetupGuidePage } from "./SetupGuidePage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const cluster = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Home",
} as Cluster;

describe("SetupGuidePage", () => {
  it("derives completion from controller state rather than visits", async () => {
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [{ enabled: true }, { enabled: true }],
      refreshedAt: "2026-08-09T00:00:00Z",
      staleAfterSeconds: 90,
    } as Awaited<ReturnType<typeof api.nodes>>);
    vi.spyOn(api, "configurationInventory").mockResolvedValue({
      snapshots: [{}],
      draft: {},
    } as Awaited<ReturnType<typeof api.configurationInventory>>);
    vi.spyOn(api, "configurationRevisions").mockResolvedValue({
      items: [{ active: true }],
    } as Awaited<ReturnType<typeof api.configurationRevisions>>);
    vi.spyOn(api, "deployments").mockResolvedValue({
      items: [{ status: "succeeded" }],
    } as Awaited<ReturnType<typeof api.deployments>>);
    vi.spyOn(api, "statistics").mockResolvedValue({
      totals: { dnsQueries: 42 },
    } as Awaited<ReturnType<typeof api.statistics>>);
    vi.spyOn(api, "queryEvents").mockResolvedValue({
      items: [{}],
    } as Awaited<ReturnType<typeof api.queryEvents>>);
    vi.spyOn(api, "haStatus").mockResolvedValue({
      nodes: [{}],
    } as Awaited<ReturnType<typeof api.haStatus>>);
    vi.spyOn(api, "operationalStatus").mockResolvedValue({
      summary: { state: "healthy" },
    } as Awaited<ReturnType<typeof api.operationalStatus>>);

    const { container } = render(<SetupGuidePage cluster={cluster} />);
    await screen.findByText("Active revision deployed");
    expect(container.querySelectorAll(".setup-guide__complete")).toHaveLength(
      11,
    );
  });
});
