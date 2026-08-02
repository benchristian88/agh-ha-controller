// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import type {
  BlockedServicesCatalogue,
  CapabilityProfile,
  Cluster,
  ConfigurationDraft,
  DesiredConfigurationDocument,
  Node,
  PersistentClient,
} from "../../lib/types";
import { ClientsPage } from "./ClientsPage";

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

const printer: PersistentClient = {
  name: "Printer",
  ids: ["192.0.2.10", "00:11:22:33:44:55"],
  useGlobalSettings: true,
  filteringEnabled: true,
  parentalEnabled: false,
  safeBrowsingEnabled: false,
  safeSearch: {
    enabled: false,
    bing: true,
    duckDuckGo: true,
    ecosia: true,
    google: true,
    pixabay: true,
    yandex: true,
    youTube: true,
  },
  useGlobalBlockedServices: false,
  blockedServices: ["youtube", "legacy-service"],
  blockedServicesSchedule: {
    timeZone: "Pacific/Auckland",
    days: { mon: { start: 3_600_000, end: 7_200_000 } },
  },
  upstreams: ["tls://dns.one", "1.1.1.1"],
  upstreamsCacheEnabled: true,
  upstreamsCacheSize: 1_048_576,
  tags: ["device_printer", "Legacy_Tag"],
  ignoreQueryLog: false,
  ignoreStatistics: false,
};

const phone: PersistentClient = {
  ...printer,
  name: "Phone",
  ids: ["phone-client-id"],
  tags: ["user_regular"],
  blockedServices: [],
  useGlobalBlockedServices: true,
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

const capability: CapabilityProfile = {
  nodeId: node.id,
  productVersion: "v0.107.78",
  compatibility: "supported",
  schemaVersion: 2,
  features: { clients: true, safe_search_ecosia: true },
  warnings: [],
  refreshedAt: "2026-08-01T00:00:00Z",
};

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

function makeDraft(clients = [printer, phone]): ConfigurationDraft {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    clusterId: cluster.id,
    sourceSnapshotId: "55555555-5555-4555-8555-555555555555",
    schemaVersion: 2,
    document: {
      schemaVersion: 2,
      shared: { clients },
      nodeOverrides: {},
      unsupported: [],
    } as unknown as DesiredConfigurationDocument,
    canonicalHash: "hash",
    version: 1,
    updatedAt: "2026-08-01T00:00:00Z",
  };
}

function mockLoad(
  draft = makeDraft(),
  catalogueResult: BlockedServicesCatalogue | Error = catalogue,
) {
  vi.spyOn(api, "configurationInventory").mockResolvedValue({
    schemaVersion: 2,
    snapshots: [],
    capabilities: [capability],
    draft,
  });
  vi.spyOn(api, "nodes").mockResolvedValue({
    items: [node],
    refreshedAt: "2026-08-01T00:00:00Z",
    staleAfterSeconds: 60,
  });
  const catalogueSpy = vi.spyOn(api, "blockedServicesCatalogue");
  if (catalogueResult instanceof Error)
    catalogueSpy.mockRejectedValue(catalogueResult);
  else catalogueSpy.mockResolvedValue(catalogueResult);
}

describe("persistent clients page", () => {
  it("migrates existing clients to searchable rows without losing summaries", async () => {
    mockLoad();
    const { container } = render(<ClientsPage cluster={cluster} />);

    expect(await screen.findByText("Printer")).not.toBeNull();
    expect(screen.getByText("Phone")).not.toBeNull();
    expect(screen.getByText("device_printer")).not.toBeNull();
    expect(screen.getAllByText("Legacy_Tag").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("table tbody tr")).toHaveLength(2);
    expect(container.querySelector(".form-card__title")).toBeNull();

    fireEvent.change(screen.getByLabelText("Search clients"), {
      target: { value: "phone-client" },
    });
    expect(screen.queryByText("Printer")).toBeNull();
    expect(screen.getByText("Phone")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Search clients"), {
      target: { value: "legacy_tag" },
    });
    expect(screen.getByText("Printer")).not.toBeNull();
    expect(screen.queryByText("Phone")).toBeNull();
  });

  it("edits all policy mappings with shared selectors and saves only the draft", async () => {
    const draft = makeDraft();
    mockLoad(draft);
    const update = vi
      .spyOn(api, "updateConfigurationDraft")
      .mockImplementation(async (_clusterID, _version, document) => ({
        draft: { ...draft, version: 2, document },
        issues: [],
      }));
    const publish = vi.spyOn(api, "publishConfigurationRevision");
    const deploy = vi.spyOn(api, "startDeployment");
    render(<ClientsPage cluster={cluster} />);

    fireEvent.click(await screen.findByLabelText("Edit Printer"));
    expect(screen.getByText("legacy-service")).not.toBeNull();
    expect(screen.getAllByText("Legacy_Tag").length).toBeGreaterThan(0);
    expect(
      (screen.getByLabelText("Block YouTube") as HTMLInputElement).checked,
    ).toBe(true);

    fireEvent.click(screen.getByLabelText("Use global filtering settings"));
    fireEvent.click(screen.getByLabelText("Safe Search"));
    fireEvent.click(screen.getByLabelText("DuckDuckGo"));
    fireEvent.click(screen.getByLabelText("Include in query log"));
    fireEvent.click(screen.getByLabelText("Include in statistics"));
    fireEvent.click(screen.getByLabelText("Block ChatGPT"));
    fireEvent.change(screen.getByLabelText("Client-specific upstreams"), {
      target: { value: "1.1.1.1\n[/example.org/]tls://dns.example" },
    });
    fireEvent.change(screen.getByLabelText("Cache size"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Draft" }));

    expect(update).not.toHaveBeenCalled();
    const saveButton = screen.getAllByRole("button", { name: "Save Draft" })[0];
    if (saveButton === undefined) throw new Error("Save Draft action missing");
    fireEvent.click(saveButton);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());

    const savedDocument = update.mock.calls[0]?.[2];
    if (savedDocument === undefined) throw new Error("Draft was not saved");
    const savedPrinter = savedDocument.shared.clients.find(
      (client) => client.name === "Printer",
    );
    expect(savedPrinter).toMatchObject({
      useGlobalSettings: false,
      ignoreQueryLog: true,
      ignoreStatistics: true,
      tags: ["device_printer", "Legacy_Tag"],
      blockedServices: ["chatgpt", "legacy-service", "youtube"],
      upstreams: ["1.1.1.1", "[/example.org/]tls://dns.example"],
      upstreamsCacheSize: 2_097_152,
    });
    expect(savedPrinter?.safeSearch.duckDuckGo).toBe(false);
    expect(savedPrinter?.safeSearch.enabled).toBe(true);
    expect(savedPrinter?.blockedServicesSchedule).toEqual(
      printer.blockedServicesSchedule,
    );
    expect(publish).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
    expect(
      screen.getByText("Draft saved. Nodes are unchanged."),
    ).not.toBeNull();
  });

  it("adds a validated client and detects cross-client duplicates", async () => {
    mockLoad();
    render(<ClientsPage cluster={cluster} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add Client" }));

    const addToDraft = screen.getByRole("button", { name: "Add to Draft" });
    expect((addToDraft as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: "printer" },
    });
    expect(screen.getByText("Client names must be unique.")).not.toBeNull();

    const identifierInput = screen.getByLabelText("New Identifiers entry");
    fireEvent.change(identifierInput, { target: { value: "999.1.1.1" } });
    expect(screen.getByText(/valid IP, CIDR, MAC address/)).not.toBeNull();
    fireEvent.change(identifierInput, { target: { value: "192.0.2.10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add identifier" }));
    expect(
      screen.getByText(
        "This identifier is already assigned to another client.",
      ),
    ).not.toBeNull();

    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: "Tablet" },
    });
    fireEvent.change(screen.getByLabelText("Identifiers entry 1"), {
      target: { value: "tablet-client-id" },
    });
    expect((addToDraft as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(addToDraft);
    expect(await screen.findByText("Tablet")).not.toBeNull();
    expect(screen.getByText("Added")).not.toBeNull();
  });

  it("confirms removal and explains draft-only deletion semantics", async () => {
    const draft = makeDraft();
    mockLoad(draft);
    const update = vi
      .spyOn(api, "updateConfigurationDraft")
      .mockImplementation(async (_clusterID, _version, document) => ({
        draft: { ...draft, version: 2, document },
        issues: [],
      }));
    const publish = vi.spyOn(api, "publishConfigurationRevision");
    const deploy = vi.spyOn(api, "startDeployment");
    render(<ClientsPage cluster={cluster} />);

    fireEvent.click(await screen.findByLabelText("Remove Printer"));
    const dialog = screen.getByRole("dialog", { name: "Remove Printer?" });
    expect(
      within(dialog).getByText(
        /will not be deleted from any AdGuard Home node/,
      ),
    ).not.toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove from Draft" }),
    );
    expect(screen.queryByText("Printer")).toBeNull();
    expect(
      screen.getByText(/Printer will remain on every node/),
    ).not.toBeNull();
    expect(update).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();

    const saveButton = screen.getAllByRole("button", { name: "Save Draft" })[0];
    if (saveButton === undefined) throw new Error("Save Draft action missing");
    fireEvent.click(saveButton);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0]?.[2].shared.clients).toEqual([phone]);
  });

  it("renders loading, empty, retryable error, and partial catalogue states", async () => {
    mockLoad(makeDraft([]), new Error("Catalogue failed"));
    const view = render(<ClientsPage cluster={cluster} />);
    expect(screen.getByLabelText("Loading persistent clients")).not.toBeNull();
    expect(await screen.findByText("No persistent clients")).not.toBeNull();
    expect(
      screen.getByText("Blocked-services catalogue unavailable"),
    ).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Add Client" }).length).toBe(
      2,
    );
    view.unmount();

    vi.restoreAllMocks();
    const unsupportedDraft = makeDraft();
    unsupportedDraft.document.schemaVersion = 1;
    mockLoad(unsupportedDraft);
    const unsupportedView = render(<ClientsPage cluster={cluster} />);
    expect(await screen.findByText("Unsupported draft format")).not.toBeNull();
    unsupportedView.unmount();

    vi.restoreAllMocks();
    vi.spyOn(api, "configurationInventory").mockRejectedValue(
      new Error("Inventory failed"),
    );
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [],
      refreshedAt: "2026-08-01T00:00:00Z",
      staleAfterSeconds: 60,
    });
    render(<ClientsPage cluster={cluster} />);
    expect(await screen.findByText("Inventory failed")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull();
  });

  it.each([
    ["light", 1440],
    ["dark", 390],
  ])(
    "renders the table and keyboard dialog in %s theme at %dpx",
    async (theme, width) => {
      document.documentElement.dataset.theme = theme;
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: width,
      });
      mockLoad();
      const { container } = render(<ClientsPage cluster={cluster} />);
      fireEvent.click(await screen.findByLabelText("Edit Printer"));
      const dialog = screen.getByRole("dialog", {
        name: "Edit Persistent Client",
      });
      expect(dialog).not.toBeNull();
      expect(container.querySelector(".data-table")).not.toBeNull();
      expect(document.documentElement.dataset.theme).toBe(theme);
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(
        screen.queryByRole("dialog", { name: "Edit Persistent Client" }),
      ).toBeNull();
    },
  );
});
