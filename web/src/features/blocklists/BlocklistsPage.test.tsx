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
  BlocklistPresentation,
  Cluster,
  ConfigurationDraft,
  ConfigurationRevision,
  DesiredConfigurationDocument,
  Node,
} from "../../lib/types";
import { BlocklistsPage } from "./BlocklistsPage";

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
  activeRevisionId: "66666666-6666-4666-8666-666666666666",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const filterURL = "https://filters.test/list.txt";
const desiredDocument = {
  schemaVersion: 2,
  shared: {
    filtering: {
      enabled: true,
      updateIntervalHours: 24,
      filterUrls: [filterURL],
      whitelistUrls: ["https://allow.test/list.txt"],
      userRules: ["||ads.test^"],
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

function node(id: string, name: string): Node {
  return {
    id,
    clusterId: cluster.id,
    name,
    baseUrl: `http://${name.toLowerCase()}.test`,
    certificatePolicy: "insecure_http",
    enabled: true,
    version: "v0.107.78",
    healthStatus: "healthy",
    compatibilityStatus: "supported",
    maintenanceMode: false,
    convergenceStatus: "converged",
    recordVersion: 1,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  };
}

const primary = node("22222222-2222-4222-8222-222222222222", "Primary");
const secondary = node("33333333-3333-4333-8333-333333333333", "Secondary");
const presentation: BlocklistPresentation = {
  generatedAt: "2026-08-01T00:00:00Z",
  stale: false,
  partial: false,
  nodes: [
    {
      nodeId: primary.id,
      nodeName: primary.name,
      status: "available",
      fetchedAt: "2026-08-01T00:00:00Z",
      lists: [
        {
          id: 7,
          url: filterURL,
          name: "Primary list",
          enabled: true,
          ruleCount: 100,
          lastUpdated: "2026-08-01T00:00:00Z",
          portable: true,
        },
      ],
    },
    {
      nodeId: secondary.id,
      nodeName: secondary.name,
      status: "available",
      fetchedAt: "2026-08-01T00:00:00Z",
      lists: [
        {
          id: 91,
          url: filterURL,
          name: "Secondary list",
          enabled: false,
          ruleCount: 101,
          lastUpdated: "2026-07-31T00:00:00Z",
          portable: true,
        },
      ],
    },
  ],
};

const activeRevision = {
  id: cluster.activeRevisionId,
  clusterId: cluster.id,
  revisionNumber: 3,
  schemaVersion: 2,
  document: desiredDocument,
  canonicalHash: "active-hash",
  summary: "Active",
  createdBy: "user",
  createdAt: "2026-08-01T00:00:00Z",
  active: true,
} as ConfigurationRevision;

function mockLoad(metadata = presentation) {
  vi.spyOn(api, "configurationInventory").mockResolvedValue({
    schemaVersion: 2,
    snapshots: [],
    capabilities: [],
    draft,
  });
  vi.spyOn(api, "nodes").mockResolvedValue({
    items: [primary, secondary],
    refreshedAt: "2026-08-01T00:00:00Z",
    staleAfterSeconds: 60,
  });
  vi.spyOn(api, "configurationRevisions").mockResolvedValue({
    items: [activeRevision],
  });
  vi.spyOn(api, "blocklistPresentation").mockResolvedValue(metadata);
}

describe("DNS blocklists page", () => {
  it("renders loading, empty, and retryable error states", async () => {
    mockLoad();
    const loadingView = render(<BlocklistsPage cluster={cluster} />);
    expect(screen.getByLabelText("Loading DNS blocklists")).not.toBeNull();
    await screen.findByRole("table");
    loadingView.unmount();

    vi.restoreAllMocks();
    const emptyDocument = {
      ...desiredDocument,
      shared: {
        ...desiredDocument.shared,
        filtering: {
          ...desiredDocument.shared.filtering,
          filterUrls: [],
        },
      },
    };
    vi.spyOn(api, "configurationInventory").mockResolvedValue({
      schemaVersion: 2,
      snapshots: [],
      capabilities: [],
      draft: { ...draft, document: emptyDocument },
    });
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [],
      refreshedAt: "2026-08-01T00:00:00Z",
      staleAfterSeconds: 60,
    });
    vi.spyOn(api, "configurationRevisions").mockResolvedValue({ items: [] });
    vi.spyOn(api, "blocklistPresentation").mockResolvedValue({
      generatedAt: "2026-08-01T00:00:00Z",
      stale: false,
      partial: false,
      nodes: [],
    });
    const emptyView = render(<BlocklistsPage cluster={cluster} />);
    expect(await screen.findByText("No blocklists")).not.toBeNull();
    emptyView.unmount();

    vi.restoreAllMocks();
    vi.spyOn(api, "configurationInventory").mockRejectedValue(
      new Error("Blocklist request failed"),
    );
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [],
      refreshedAt: "2026-08-01T00:00:00Z",
      staleAfterSeconds: 60,
    });
    vi.spyOn(api, "configurationRevisions").mockResolvedValue({ items: [] });
    vi.spyOn(api, "blocklistPresentation").mockResolvedValue({
      generatedAt: "2026-08-01T00:00:00Z",
      stale: false,
      partial: false,
      nodes: [],
    });
    render(<BlocklistsPage cluster={cluster} />);
    expect(await screen.findByText("Blocklist request failed")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull();
  });

  it("migrates textarea URLs into searchable rows with mixed node metadata", async () => {
    mockLoad();
    render(<BlocklistsPage cluster={cluster} />);
    expect(await screen.findByText(filterURL)).not.toBeNull();
    expect(screen.getByText("Mixed names")).not.toBeNull();
    expect(screen.getAllByText("Mixed")).toHaveLength(2);
    expect(screen.getByText("Mixed node state")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Search blocklists"), {
      target: { value: "not-present" },
    });
    expect(screen.getByText("No blocklists match")).not.toBeNull();
  });

  it("adds only valid portable URLs and Save Draft never publishes or deploys", async () => {
    mockLoad();
    const update = vi
      .spyOn(api, "updateConfigurationDraft")
      .mockImplementation(async (_clusterID, _version, document) => ({
        draft: { ...draft, version: 2, document },
        issues: [],
      }));
    const publish = vi.spyOn(api, "publishConfigurationRevision");
    const deploy = vi.spyOn(api, "startDeployment");
    render(<BlocklistsPage cluster={cluster} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Add blocklist" }),
    );
    const input = screen.getByLabelText(/Blocklist URL/);
    fireEvent.change(input, { target: { value: "/opt/adguard/list.txt" } });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    expect(
      await screen.findByText("Enter an absolute HTTP or HTTPS URL."),
    ).not.toBeNull();
    expect(
      screen.getByText(/Local file paths are not assumed portable/),
    ).not.toBeNull();

    fireEvent.change(input, {
      target: { value: "https://new.test/blocklist.txt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    expect(await screen.findByText("Added to draft")).not.toBeNull();
    const saveDraft = screen.getByRole("button", { name: "Save Draft" });
    fireEvent.click(saveDraft);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0]?.[2].shared.filtering.filterUrls).toContain(
      "https://new.test/blocklist.txt",
    );
    expect(publish).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
    expect(
      screen.getByText("Draft saved. Nodes are unchanged."),
    ).not.toBeNull();
  });

  it("previews edit reconciliation and confirms accurate disable-oriented removal", async () => {
    mockLoad();
    render(<BlocklistsPage cluster={cluster} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/Blocklist URL/), {
      target: { value: "https://filters.test/replacement.txt" },
    });
    expect(screen.getByText("Effective reconciliation preview")).not.toBeNull();
    expect(screen.getByText(/disable the old URL/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    expect(await screen.findByText("Removal pending")).not.toBeNull();
    expect(screen.getByText("Added to draft")).not.toBeNull();

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    fireEvent.click(removeButtons[0] as HTMLButtonElement);
    expect(
      screen.getByRole("heading", {
        name: "Remove blocklist from desired configuration?",
      }),
    ).not.toBeNull();
    expect(screen.getByText(/does not delete it/)).not.toBeNull();
  });

  it("uses the row switch for the same confirmed disable-oriented draft change", async () => {
    mockLoad();
    render(<BlocklistsPage cluster={cluster} />);
    fireEvent.click(await screen.findByLabelText("Disable Primary list"));
    expect(
      screen.getByRole("heading", {
        name: "Remove blocklist from desired configuration?",
      }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove from draft" }));
    expect(await screen.findByText("Removal pending")).not.toBeNull();
    expect(screen.getByText("Unsaved changes")).not.toBeNull();
  });

  it("runs audited refresh-all with visible partial per-node results", async () => {
    mockLoad();
    vi.spyOn(api, "refreshFilters").mockImplementation(async (nodeID) => {
      if (nodeID === secondary.id) throw new Error("Node unavailable");
      return { nodeId: nodeID, whitelist: false, status: "succeeded" };
    });
    render(<BlocklistsPage cluster={cluster} />);
    fireEvent.click(await screen.findByRole("button", { name: "Refresh all" }));
    expect(
      screen.getByText(/creates no configuration revision/),
    ).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh all blocklists" }),
    );
    expect(
      await screen.findByText("Blocklist refresh completed with node failures"),
    ).not.toBeNull();
    expect(screen.getByText("Node unavailable")).not.toBeNull();
    expect(api.refreshFilters).toHaveBeenCalledTimes(2);
    expect(
      (
        screen.getByRole("button", {
          name: "Refresh selected",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("renders stale and partial metadata plus keyboard-dismissible dialogs", async () => {
    mockLoad({
      ...presentation,
      stale: true,
      partial: true,
      nodes: [
        presentation.nodes[0] as NonNullable<(typeof presentation.nodes)[0]>,
        {
          nodeId: secondary.id,
          nodeName: secondary.name,
          status: "error",
          errorCode: "NODE_UNREACHABLE",
          lists: [],
        },
      ],
    });
    render(<BlocklistsPage cluster={cluster} />);
    expect(await screen.findByText("Capability data is stale")).not.toBeNull();
    expect(
      screen.getByText("Some node metadata is unavailable"),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add blocklist" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each([
    ["light", 1440],
    ["dark", 390],
  ])("renders the table in %s theme at %dpx", async (theme, width) => {
    document.documentElement.dataset.theme = theme;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    mockLoad();
    const { container } = render(<BlocklistsPage cluster={cluster} />);
    expect(await screen.findByRole("table")).not.toBeNull();
    expect(container.querySelector(".blocklists-page")).not.toBeNull();
    const subscriptions = screen
      .getByRole("heading", { name: "Blocklist subscriptions" })
      .closest(".settings-group");
    expect(
      subscriptions?.querySelector(".settings-group__body--padded"),
    ).not.toBeNull();
    expect(subscriptions?.querySelector(".data-table")).not.toBeNull();
    expect(document.documentElement.dataset.theme).toBe(theme);
  });
});
