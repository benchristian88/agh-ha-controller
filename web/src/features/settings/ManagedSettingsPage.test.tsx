// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import type {
  Cluster,
  ConfigurationDraft,
  DesiredConfigurationDocument,
} from "../../lib/types";
import { ManagedSettingsPage } from "./ManagedSettingsPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const cluster = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Home",
  description: "",
  version: 1,
  reconciliationPolicy: "manual",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
} as Cluster;

const desiredDocument = {
  schemaVersion: 2,
  shared: {
    dns: {
      protectionEnabled: true,
      upstreamDns: [],
      bootstrapDns: [],
      fallbackDns: [],
      privateReverseDns: [],
      rateLimitAllowlist: [],
    },
    filtering: {
      enabled: true,
      updateIntervalHours: 24,
      filterUrls: [],
      whitelistUrls: [],
      userRules: ["||ads.example^"],
    },
  },
  nodeOverrides: {},
  unsupported: [],
} as unknown as DesiredConfigurationDocument;

const draft = {
  id: "44444444-4444-4444-8444-444444444444",
  clusterId: cluster.id,
  sourceSnapshotId: "55555555-5555-4555-8555-555555555555",
  schemaVersion: 2,
  document: desiredDocument,
  canonicalHash: "hash",
  version: 1,
  updatedAt: "2026-08-01T00:00:00Z",
} as ConfigurationDraft;

function mockLoad() {
  vi.spyOn(api, "configurationInventory").mockResolvedValue({
    schemaVersion: 2,
    snapshots: [],
    capabilities: [],
    draft,
  });
  vi.spyOn(api, "nodes").mockResolvedValue({
    items: [],
    refreshedAt: "2026-08-01T00:00:00Z",
    staleAfterSeconds: 60,
  });
}

describe("superseded broad settings controls", () => {
  it("keeps Protection and filtering policy canonical to General Settings", async () => {
    mockLoad();
    const dns = render(<ManagedSettingsPage cluster={cluster} area="dns" />);
    expect(await screen.findByText("Resolver behavior")).not.toBeNull();
    expect(screen.queryByLabelText("Protection enabled")).toBeNull();
    dns.unmount();

    vi.restoreAllMocks();
    mockLoad();
    render(<ManagedSettingsPage cluster={cluster} area="filters" />);
    expect(await screen.findByText("Filtering policy")).not.toBeNull();
    expect(screen.getByText("Custom filtering rules (ordered)")).not.toBeNull();
    expect(screen.queryByLabelText("Filtering enabled")).toBeNull();
    expect(
      screen.queryByLabelText("Automatic update interval (hours)"),
    ).toBeNull();
  });
});
