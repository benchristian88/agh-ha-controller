// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import type { Cluster, Node } from "../../lib/types";
import { HAOperationsPage } from "./HAOperationsPage";
import { NodeLifecyclePage } from "./NodeLifecyclePage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const cluster = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Home",
  description: "",
  reconciliationPolicy: "manual",
  version: 1,
  createdAt: "2026-08-09T00:00:00Z",
  updatedAt: "2026-08-09T00:00:00Z",
} as Cluster;
const node = {
  id: "22222222-2222-4222-8222-222222222222",
  clusterId: cluster.id,
  name: "Primary",
  baseUrl: "https://node.test",
  certificatePolicy: "system",
  enabled: true,
  healthStatus: "healthy",
  compatibilityStatus: "supported",
  version: "v0.107.78",
  maintenanceMode: false,
  convergenceStatus: "converged",
  recordVersion: 2,
  createdAt: "2026-08-09T00:00:00Z",
  updatedAt: "2026-08-09T00:00:00Z",
} as Node;

function commonMocks() {
  vi.spyOn(api, "nodes").mockResolvedValue({
    items: [node],
    refreshedAt: "2026-08-09T01:00:00Z",
    staleAfterSeconds: 90,
  });
  vi.spyOn(api, "upgrades").mockResolvedValue({ items: [] });
}

describe("Release 0.8 HA operations", () => {
  it("renders separate DNS, API, convergence, certificates, versions, notifications, and history dimensions", async () => {
    commonMocks();
    vi.spyOn(api, "haStatus").mockResolvedValue({
      state: "at_risk",
      totalNodes: 1,
      servingDnsNodes: 1,
      apiReachableNodes: 1,
      convergedNodes: 1,
      maintenanceNodes: 0,
      certificateWarnings: 1,
      updateAvailableNodes: 1,
      message: "No redundancy.",
      nodes: [
        {
          nodeId: node.id,
          dnsStatus: "healthy",
          udpStatus: "healthy",
          tcpStatus: "healthy",
          dnsProbedAt: "2026-08-09T01:00:00Z",
        },
      ],
    });
    vi.spyOn(api, "certificates").mockResolvedValue({
      items: [
        {
          nodeId: node.id,
          nodeName: node.name,
          subject: "DNS certificate",
          daysRemaining: 5,
          state: "critical",
        },
      ],
    });
    vi.spyOn(api, "versions").mockResolvedValue({
      items: [
        {
          nodeId: node.id,
          nodeName: node.name,
          installedVersion: "v0.107.78",
          latestVersion: "v0.107.79",
          compatibility: "supported",
          installationType: "docker",
          upgradeSupport: "guided",
          updateAvailable: true,
          releaseCheckStale: false,
        },
      ],
    });
    vi.spyOn(api, "haHistory").mockResolvedValue({
      items: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          clusterId: cluster.id,
          nodeId: node.id,
          eventType: "dns.failed",
          severity: "critical",
          summary: "DNS failed",
          details: {},
          occurredAt: "2026-08-09T01:00:00Z",
        },
      ],
    });
    vi.spyOn(api, "notificationChannels").mockResolvedValue({ items: [] });
    const { container } = render(<HAOperationsPage cluster={cluster} />);
    expect(
      await screen.findByRole("heading", { name: "HA Operations" }),
    ).toBeTruthy();
    expect(
      screen.getAllByText("1 / 1", { selector: "strong" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("DNS certificate")).toBeTruthy();
    expect(screen.getByText("DNS failed")).toBeTruthy();
    const accessibility = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    expect(accessibility.violations).toEqual([]);
  });

  it("shows blocking DHCP maintenance preflight on node lifecycle", async () => {
    commonMocks();
    vi.spyOn(api, "nodeLifecycle").mockResolvedValue({
      generatedAt: "2026-08-09T01:00:00Z",
      settings: {
        nodeId: node.id,
        dnsProbeHost: "",
        dnsProbePort: 53,
        dnsProbeName: ".",
        dnsProbeType: "NS",
        expectedRcode: 0,
        probeUdp: true,
        probeTcp: true,
        installationType: "docker",
        recordVersion: 1,
        createdAt: "2026-08-09T00:00:00Z",
        updatedAt: "2026-08-09T00:00:00Z",
      },
      dns: {
        id: "44444444-4444-4444-8444-444444444444",
        clusterId: cluster.id,
        nodeId: node.id,
        status: "healthy",
        udpStatus: "healthy",
        tcpStatus: "healthy",
        responseCode: 0,
        latencyMs: 3,
        probedAt: "2026-08-09T01:00:00Z",
      },
      certificate: { nodeId: node.id, nodeName: node.name, state: "healthy" },
      version: {
        nodeId: node.id,
        nodeName: node.name,
        installedVersion: "v0.107.78",
        compatibility: "supported",
        installationType: "docker",
        upgradeSupport: "guided",
        updateAvailable: false,
        releaseCheckStale: false,
      },
      events: [],
    });
    vi.spyOn(api, "maintenancePreflight").mockResolvedValue({
      nodeId: node.id,
      allowed: false,
      breakGlassRequired: false,
      healthyDnsNodesRemaining: 1,
      expectedRedundancy: "at_risk",
      activeDeployment: false,
      openDrift: false,
      activeDhcp: true,
      checks: [
        {
          name: "dhcp",
          status: "fail",
          required: true,
          message: "Complete a handoff",
        },
      ],
    });
    render(<NodeLifecyclePage cluster={cluster} nodeId={node.id} />);
    expect(
      await screen.findByRole("heading", { name: "Planned Maintenance" }),
    ).toBeTruthy();
    expect(screen.getByText("Handoff required")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Enter maintenance",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
