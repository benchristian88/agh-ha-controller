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
import type {
  BlockedServicesCatalogue,
  Cluster,
  ConfigurationDraft,
  DesiredConfigurationDocument,
  Node,
} from "../../lib/types";
import { BlockedServicesPage } from "./BlockedServicesPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.theme;
});

const cluster: Cluster = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Home",
  description: "",
  version: 1,
  reconciliationPolicy: "manual",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const desiredDocument = {
  schemaVersion: 2,
  shared: {
    services: {
      blockedServiceIds: ["youtube", "legacy-service"],
      blockedSchedule: { timeZone: "Pacific/Auckland", days: {} },
      safeBrowsing: true,
      parentalControl: false,
      safeSearch: {},
    },
  },
  nodeOverrides: {},
  unsupported: [],
} as unknown as DesiredConfigurationDocument;

const draft: ConfigurationDraft = {
  id: "44444444-4444-4444-8444-444444444444",
  clusterId: cluster.id,
  sourceSnapshotId: "55555555-5555-4555-8555-555555555555",
  schemaVersion: 2,
  document: desiredDocument,
  canonicalHash: "hash",
  version: 1,
  updatedAt: "2026-08-01T00:00:00Z",
};

const node = {
  id: "22222222-2222-4222-8222-222222222222",
  clusterId: cluster.id,
  name: "Primary",
  enabled: true,
  version: "v0.107.78",
  healthStatus: "healthy",
  compatibilityStatus: "supported",
  maintenanceMode: false,
  convergenceStatus: "converged",
  recordVersion: 1,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
} as Node;

const catalogue: BlockedServicesCatalogue = {
  generatedAt: "2026-08-01T00:00:00Z",
  stale: false,
  partial: false,
  groups: [{ id: "ai" }, { id: "streaming" }],
  nodes: [
    {
      nodeId: node.id,
      nodeName: node.name,
      version: node.version,
      status: "available",
      serviceCount: 2,
    },
  ],
  services: [
    {
      id: "chatgpt",
      name: "ChatGPT",
      groupId: "ai",
      supportedNodeIds: [node.id],
      unsupportedNodeIds: [],
    },
    {
      id: "youtube",
      name: "YouTube",
      groupId: "streaming",
      supportedNodeIds: [node.id],
      unsupportedNodeIds: [],
    },
  ],
};

function mockLoad(catalogueResult = catalogue) {
  vi.spyOn(api, "configurationInventory").mockResolvedValue({
    schemaVersion: 2,
    snapshots: [],
    capabilities: [],
    draft,
  });
  vi.spyOn(api, "nodes").mockResolvedValue({
    items: [node],
    refreshedAt: "2026-08-01T00:00:00Z",
    staleAfterSeconds: 60,
  });
  vi.spyOn(api, "configurationRevisions").mockResolvedValue({ items: [] });
  vi.spyOn(api, "blockedServicesCatalogue").mockResolvedValue(catalogueResult);
}

describe("blocked services page", () => {
  it("renders loading, empty catalogue, and retryable error states", async () => {
    mockLoad({ ...catalogue, services: [], groups: [] });
    const view = render(<BlockedServicesPage cluster={cluster} />);
    expect(
      screen.getByLabelText("Loading blocked-services catalogue"),
    ).not.toBeNull();
    expect(
      await screen.findByText("No catalogue services are available"),
    ).not.toBeNull();
    expect(screen.getByText("legacy-service")).not.toBeNull();
    view.unmount();

    vi.restoreAllMocks();
    vi.spyOn(api, "configurationInventory").mockRejectedValue(
      new Error("Catalogue request failed"),
    );
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [node],
      refreshedAt: "2026-08-01T00:00:00Z",
      staleAfterSeconds: 60,
    });
    vi.spyOn(api, "configurationRevisions").mockResolvedValue({ items: [] });
    vi.spyOn(api, "blockedServicesCatalogue").mockResolvedValue(catalogue);
    render(<BlockedServicesPage cluster={cluster} />);
    expect(await screen.findByText("Catalogue request failed")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull();
  });

  it("migrates raw IDs into selection and Save Draft performs no publication or deployment", async () => {
    mockLoad();
    const update = vi
      .spyOn(api, "updateConfigurationDraft")
      .mockImplementation(async (_clusterID, _version, updatedDocument) => ({
        draft: { ...draft, version: 2, document: updatedDocument },
        issues: [],
      }));
    const publish = vi.spyOn(api, "publishConfigurationRevision");
    const deploy = vi.spyOn(api, "startDeployment");
    render(<BlockedServicesPage cluster={cluster} />);

    expect(
      await screen.findByRole("heading", { name: "Blocked Services" }),
    ).not.toBeNull();
    expect(
      ((await screen.findByLabelText("Block YouTube")) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(screen.getByText("legacy-service")).not.toBeNull();

    fireEvent.click(screen.getByLabelText("Block ChatGPT"));
    const saveButtons = screen.getAllByRole("button", { name: "Save Draft" });
    const saveButton = saveButtons[0];
    if (saveButton === undefined) throw new Error("Save Draft action missing");
    fireEvent.click(saveButton);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    const savedDocument = update.mock.calls[0]?.[2];
    if (savedDocument === undefined) throw new Error("Draft was not saved");
    expect(savedDocument.shared.services.blockedServiceIds).toEqual([
      "chatgpt",
      "legacy-service",
      "youtube",
    ]);
    expect(savedDocument.shared.services.blockedSchedule).toEqual({
      timeZone: "Pacific/Auckland",
      days: {},
    });
    expect(publish).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
    expect(
      screen.getByText("Draft saved. Nodes are unchanged."),
    ).not.toBeNull();
  });

  it("renders stale and partial-node catalogue states", async () => {
    mockLoad({
      ...catalogue,
      stale: true,
      partial: true,
      nodes: [
        ...catalogue.nodes,
        {
          nodeId: "node-b",
          nodeName: "Secondary",
          status: "error",
          serviceCount: 0,
          errorCode: "NODE_UNREACHABLE",
        },
      ],
    });
    render(<BlockedServicesPage cluster={cluster} />);
    expect(await screen.findByText("Capability data is stale")).not.toBeNull();
    expect(
      screen.getByText("Some node catalogues are unavailable"),
    ).not.toBeNull();
    expect(screen.getByText(/Secondary: error/)).not.toBeNull();
  });

  it.each([
    ["light", 1440],
    ["dark", 390],
  ])("renders the catalogue in %s theme at %dpx", async (theme, width) => {
    document.documentElement.dataset.theme = theme;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    mockLoad();
    const { container } = render(<BlockedServicesPage cluster={cluster} />);
    expect(await screen.findByLabelText("Search services")).not.toBeNull();
    expect(container.querySelector(".service-catalogue")).not.toBeNull();
    expect(document.documentElement.dataset.theme).toBe(theme);
    delete document.documentElement.dataset.theme;
  });
});
