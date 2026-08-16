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
  function mockState(nodeCount: number, complete = false) {
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: Array.from({ length: nodeCount }, () => ({ enabled: true })),
      refreshedAt: "2026-08-09T00:00:00Z",
      staleAfterSeconds: 90,
    } as Awaited<ReturnType<typeof api.nodes>>);
    vi.spyOn(api, "configurationInventory").mockResolvedValue({
      snapshots: complete ? [{}] : [],
      draft: complete ? {} : undefined,
    } as Awaited<ReturnType<typeof api.configurationInventory>>);
    vi.spyOn(api, "configurationRevisions").mockResolvedValue({
      items: complete ? [{ active: true }] : [],
    } as Awaited<ReturnType<typeof api.configurationRevisions>>);
    vi.spyOn(api, "deployments").mockResolvedValue({
      items: complete ? [{ status: "succeeded" }] : [],
    } as Awaited<ReturnType<typeof api.deployments>>);
    vi.spyOn(api, "statistics").mockResolvedValue({
      totals: { dnsQueries: complete ? 42 : 0 },
    } as Awaited<ReturnType<typeof api.statistics>>);
    vi.spyOn(api, "queryEvents").mockResolvedValue({
      items: complete ? [{}] : [],
    } as Awaited<ReturnType<typeof api.queryEvents>>);
    vi.spyOn(api, "haStatus").mockResolvedValue({
      nodes: Array.from({ length: nodeCount }, () => ({})),
    } as Awaited<ReturnType<typeof api.haStatus>>);
    vi.spyOn(api, "operationalStatus").mockResolvedValue({
      summary: { state: "healthy" },
    } as Awaited<ReturnType<typeof api.operationalStatus>>);
  }

  it("renders a new zero-node cluster as incomplete setup", async () => {
    mockState(0);

    const { container } = render(<SetupGuidePage cluster={cluster} />);

    await screen.findByText("First AdGuard Home node added");
    expect(screen.getByRole("link", { name: "Add first node" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.querySelectorAll(".setup-guide__complete")).toHaveLength(
      2,
    );
  });

  it("keeps the redundant-node step incomplete for one node", async () => {
    mockState(1);

    const { container } = render(<SetupGuidePage cluster={cluster} />);

    await screen.findByText("Redundant node added");
    expect(container.querySelectorAll(".setup-guide__complete")).toHaveLength(
      4,
    );
    expect(
      screen.getByRole("link", { name: "Add redundant node" }),
    ).toBeTruthy();
  });

  it("derives complete multi-node progress from controller state", async () => {
    mockState(2, true);

    const { container } = render(<SetupGuidePage cluster={cluster} />);
    await screen.findByText("Active revision deployed");
    expect(container.querySelectorAll(".setup-guide__complete")).toHaveLength(
      11,
    );
  });

  it("keeps loading distinct from an empty result", () => {
    mockState(0);
    vi.spyOn(api, "nodes").mockReturnValue(new Promise(() => undefined));

    render(<SetupGuidePage cluster={cluster} />);

    expect(screen.getByRole("status").textContent).toContain(
      "Checking setup progress",
    );
    expect(screen.queryByText("First AdGuard Home node added")).toBeNull();
  });

  it("renders genuine API failures with retry instead of incomplete steps", async () => {
    mockState(0);
    vi.spyOn(api, "nodes").mockRejectedValue(new Error("node API unavailable"));

    render(<SetupGuidePage cluster={cluster} />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "node API unavailable",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("First AdGuard Home node added")).toBeNull();
  });
});
