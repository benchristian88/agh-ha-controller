// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import type { Cluster, Node } from "../../lib/types";
import { NodesPage } from "./NodesPage";

const cluster: Cluster = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Home",
  description: "",
  version: 1,
  reconciliationPolicy: "manual",
  createdAt: "2026-08-16T00:00:00Z",
  updatedAt: "2026-08-16T00:00:00Z",
};

const node: Node = {
  id: "22222222-2222-4222-8222-222222222222",
  clusterId: cluster.id,
  name: "Primary DNS",
  baseUrl: "https://dns.example.test",
  certificatePolicy: "system",
  enabled: true,
  healthStatus: "healthy",
  compatibilityStatus: "supported",
  version: "v0.107.78",
  maintenanceMode: false,
  convergenceStatus: "converged",
  recordVersion: 4,
  createdAt: "2026-08-16T00:00:00Z",
  updatedAt: "2026-08-16T00:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockSupportingRequests() {
  vi.spyOn(api, "configurationInventory").mockResolvedValue({
    schemaVersion: 2,
    snapshots: [],
    capabilities: [],
  });
  vi.spyOn(api, "configurationRevisions").mockResolvedValue({ items: [] });
  vi.spyOn(api, "driftEvents").mockResolvedValue({ items: [] });
}

function nodeResponse(value: Node) {
  return {
    items: [value],
    refreshedAt: "2026-08-16T00:00:00Z",
    staleAfterSeconds: 60,
  };
}

describe("Nodes maintenance lifecycle", () => {
  it("uses the Nodes-only five-card summary layout", async () => {
    mockSupportingRequests();
    vi.spyOn(api, "nodes").mockResolvedValue(nodeResponse(node));

    render(<NodesPage cluster={cluster} />);

    const summary = await screen.findByLabelText("Cluster node summary");
    expect(summary.classList.contains("convergence-summary--five")).toBe(true);
    expect(summary.querySelectorAll("dl > div")).toHaveLength(5);
  });

  it("enters maintenance through preflight and the canonical lifecycle action", async () => {
    mockSupportingRequests();
    const maintenanceNode: Node = {
      ...node,
      maintenanceMode: true,
      convergenceStatus: "maintenance",
      recordVersion: 5,
    };
    vi.spyOn(api, "nodes")
      .mockResolvedValueOnce(nodeResponse(node))
      .mockResolvedValue(nodeResponse(maintenanceNode));
    vi.spyOn(api, "maintenancePreflight").mockResolvedValue({
      nodeId: node.id,
      allowed: true,
      breakGlassRequired: false,
      healthyDnsNodesRemaining: 1,
      expectedRedundancy: "healthy",
      activeDeployment: false,
      openDrift: false,
      activeDhcp: false,
      checks: [],
    });
    const enter = vi
      .spyOn(api, "enterMaintenance")
      .mockResolvedValue(maintenanceNode);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<NodesPage cluster={cluster} />);
    fireEvent.click(await screen.findByRole("button", { name: "Maintenance" }));

    await waitFor(() => expect(enter).toHaveBeenCalledWith(node, false, ""));
    expect(
      await screen.findByRole("button", { name: "Leave maintenance" }),
    ).toBeTruthy();
  });

  it("returns to service and reloads canonical normal state", async () => {
    mockSupportingRequests();
    const maintenanceNode: Node = {
      ...node,
      maintenanceMode: true,
      convergenceStatus: "maintenance",
    };
    const normalNode: Node = { ...node, recordVersion: 5 };
    vi.spyOn(api, "nodes")
      .mockResolvedValueOnce(nodeResponse(maintenanceNode))
      .mockResolvedValue(nodeResponse(normalNode));
    const returnToService = vi.spyOn(api, "returnToService").mockResolvedValue({
      nodeId: node.id,
      succeeded: true,
      checks: [],
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<NodesPage cluster={cluster} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Leave maintenance" }),
    );

    await waitFor(() =>
      expect(returnToService).toHaveBeenCalledWith(maintenanceNode),
    );
    expect(
      await screen.findByRole("button", { name: "Maintenance" }),
    ).toBeTruthy();

    cleanup();
    render(<NodesPage cluster={cluster} />);
    expect(
      await screen.findByRole("button", { name: "Maintenance" }),
    ).toBeTruthy();
  });

  it("keeps canonical maintenance state and exposes return failures", async () => {
    mockSupportingRequests();
    const maintenanceNode: Node = {
      ...node,
      maintenanceMode: true,
      convergenceStatus: "maintenance",
    };
    const nodes = vi
      .spyOn(api, "nodes")
      .mockResolvedValue(nodeResponse(maintenanceNode));
    vi.spyOn(api, "returnToService").mockRejectedValue(
      new Error(
        "Node remains in maintenance because return-to-service validation failed.",
      ),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<NodesPage cluster={cluster} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Leave maintenance" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Unable to update maintenance mode",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Node remains in maintenance because/),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Leave maintenance" }),
    ).toBeTruthy();
    expect(nodes).toHaveBeenCalledTimes(2);
  });
});
