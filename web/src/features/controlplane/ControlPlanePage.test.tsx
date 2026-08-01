// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import type { Cluster, Deployment, Node } from "../../lib/types";
import { ControlPlanePage } from "./ControlPlanePage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const cluster: Cluster = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Home",
  description: "",
  version: 1,
  reconciliationPolicy: "manual",
  createdAt: "2026-08-02T00:00:00Z",
  updatedAt: "2026-08-02T00:00:00Z",
};

const node: Node = {
  id: "22222222-2222-4222-8222-222222222222",
  clusterId: cluster.id,
  name: "Primary",
  baseUrl: "http://primary.test",
  certificatePolicy: "insecure_http",
  enabled: true,
  healthStatus: "healthy",
  compatibilityStatus: "supported",
  version: "v0.107.78",
  maintenanceMode: false,
  convergenceStatus: "apply_failed",
  recordVersion: 1,
  createdAt: "2026-08-02T00:00:00Z",
  updatedAt: "2026-08-02T00:00:00Z",
};

const deployment: Deployment = {
  id: "33333333-3333-4333-8333-333333333333",
  clusterId: cluster.id,
  revisionId: "44444444-4444-4444-8444-444444444444",
  status: "failed",
  strategy: "sequential",
  failurePolicy: "stop",
  origin: "manual",
  requestId: "request-1",
  cancelRequested: false,
  errorCode: "NODE_APPLY_FAILED",
  requestedAt: "2026-08-02T00:00:00Z",
  nodes: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      deploymentId: "33333333-3333-4333-8333-333333333333",
      nodeId: node.id,
      position: 1,
      effectiveHash: "hash",
      status: "failed",
      attemptCount: 1,
      errorCode: "NODE_APPLY_FAILED",
      errorMessage:
        "AdGuard Home rejected POST /control/dhcp/set_config with HTTP 400",
    },
  ],
};

describe("ControlPlanePage", () => {
  it("shows the safe per-node deployment failure detail", async () => {
    vi.spyOn(api, "deployments").mockResolvedValue({ items: [deployment] });
    vi.spyOn(api, "deployment").mockResolvedValue(deployment);
    vi.spyOn(api, "driftEvents").mockResolvedValue({ items: [] });
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [node],
      refreshedAt: "2026-08-02T00:00:00Z",
      staleAfterSeconds: 60,
    });
    vi.spyOn(api, "configurationInventory").mockResolvedValue({
      schemaVersion: 2,
      snapshots: [],
      capabilities: [],
    });

    render(<ControlPlanePage cluster={cluster} />);

    expect(await screen.findByText("Primary")).toBeTruthy();
    expect(
      screen.getByText(
        "AdGuard Home rejected POST /control/dhcp/set_config with HTTP 400",
      ),
    ).toBeTruthy();
  });
});
