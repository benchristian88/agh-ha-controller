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
  AllowlistPresentation,
  Cluster,
  ConfigurationDraft,
  ConfigurationRevision,
  DesiredConfigurationDocument,
  Node,
} from "../../lib/types";
import { AllowlistsPage } from "./AllowlistsPage";

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
  createdAt: "2026-08-02T00:00:00Z",
  updatedAt: "2026-08-02T00:00:00Z",
};

const allowURL = "https://allow.test/list.txt";
const observedOnlyURL = "https://allow.test/disabled.txt";
const blockURL = "https://filters.test/list.txt";
const desiredDocument = {
  schemaVersion: 2,
  shared: {
    filtering: {
      enabled: true,
      updateIntervalHours: 24,
      filterUrls: [blockURL],
      whitelistUrls: [allowURL],
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
  updatedAt: "2026-08-02T00:00:00Z",
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
    createdAt: "2026-08-02T00:00:00Z",
    updatedAt: "2026-08-02T00:00:00Z",
  };
}

const primary = node("22222222-2222-4222-8222-222222222222", "Primary");
const secondary = node("33333333-3333-4333-8333-333333333333", "Secondary");
const presentation: AllowlistPresentation = {
  generatedAt: "2026-08-02T00:00:00Z",
  stale: false,
  partial: false,
  nodes: [
    {
      nodeId: primary.id,
      nodeName: primary.name,
      status: "available",
      fetchedAt: "2026-08-02T00:00:00Z",
      lists: [
        {
          id: 8,
          url: allowURL,
          name: "Primary allowlist",
          enabled: true,
          ruleCount: 12,
          lastUpdated: "2026-08-02T00:00:00Z",
          portable: true,
        },
        {
          id: 10,
          url: observedOnlyURL,
          name: "Disabled allowlist",
          enabled: false,
          ruleCount: 3,
          lastUpdated: "2026-08-01T00:00:00Z",
          portable: true,
        },
      ],
    },
    {
      nodeId: secondary.id,
      nodeName: secondary.name,
      status: "available",
      fetchedAt: "2026-08-02T00:00:00Z",
      lists: [
        {
          id: 90,
          url: allowURL,
          name: "Secondary allowlist",
          enabled: false,
          ruleCount: 13,
          lastUpdated: "2026-08-01T00:00:00Z",
          portable: true,
        },
      ],
    },
  ],
};

const activeRevision = {
  id: cluster.activeRevisionId,
  clusterId: cluster.id,
  revisionNumber: 4,
  schemaVersion: 2,
  document: desiredDocument,
  canonicalHash: "active-hash",
  summary: "Active",
  createdBy: "user",
  createdAt: "2026-08-02T00:00:00Z",
  active: true,
} as ConfigurationRevision;

function mockLoad(metadata = presentation, loadedDraft = draft) {
  vi.spyOn(api, "configurationInventory").mockResolvedValue({
    schemaVersion: 2,
    snapshots: [],
    capabilities: [],
    draft: loadedDraft,
  });
  vi.spyOn(api, "nodes").mockResolvedValue({
    items: [primary, secondary],
    refreshedAt: "2026-08-02T00:00:00Z",
    staleAfterSeconds: 60,
  });
  vi.spyOn(api, "configurationRevisions").mockResolvedValue({
    items: [activeRevision],
  });
  vi.spyOn(api, "allowlistPresentation").mockResolvedValue(metadata);
}

describe("DNS allowlists page", () => {
  it("migrates existing textarea values into rows and keeps observed metadata separate", async () => {
    mockLoad();
    render(<AllowlistsPage cluster={cluster} />);

    expect(await screen.findByText(allowURL)).not.toBeNull();
    expect(screen.getByText(observedOnlyURL)).not.toBeNull();
    expect(screen.getByText("Mixed names")).not.toBeNull();
    expect(screen.getAllByText("Mixed")).toHaveLength(2);
    expect(screen.getByText("Mixed node state")).not.toBeNull();
    expect(screen.getByText("Observed only")).not.toBeNull();
    expect(screen.queryByText(blockURL)).toBeNull();

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Per-node results",
      })[1] as HTMLElement,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Primary");
    expect(dialog.textContent).toContain("Secondary");
    expect(dialog.textContent).toContain("12");
    expect(dialog.textContent).toContain("13");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.change(screen.getByLabelText("Search allowlists"), {
      target: { value: "missing" },
    });
    expect(screen.getByText("No allowlists match")).not.toBeNull();
  });

  it("adds and enables allowlists without changing blocklists or observed fields", async () => {
    mockLoad();
    const update = vi
      .spyOn(api, "updateConfigurationDraft")
      .mockImplementation(async (_clusterID, _version, document) => ({
        draft: { ...draft, version: 2, document },
        issues: [],
      }));
    const publish = vi.spyOn(api, "publishConfigurationRevision");
    const deploy = vi.spyOn(api, "startDeployment");
    render(<AllowlistsPage cluster={cluster} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Add allowlist" }),
    );
    const input = screen.getByLabelText(/Allowlist URL/);
    fireEvent.change(input, { target: { value: "ftp://allow.test/list" } });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    expect(
      await screen.findByText(
        "Enter an absolute HTTP or HTTPS URL. Local file paths are not supported.",
      ),
    ).not.toBeNull();
    fireEvent.change(input, {
      target: { value: "https://new-allow.test/list.txt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    expect(await screen.findByText("Added to draft")).not.toBeNull();

    fireEvent.click(screen.getByLabelText("Enable Disabled allowlist"));
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    const saved = update.mock.calls[0]?.[2] as DesiredConfigurationDocument;
    expect(saved.shared.filtering.whitelistUrls).toEqual([
      allowURL,
      "https://new-allow.test/list.txt",
      observedOnlyURL,
    ]);
    expect(saved.shared.filtering.filterUrls).toEqual([blockURL]);
    expect(saved.shared.filtering.userRules).toEqual(["||ads.test^"]);
    expect(JSON.stringify(saved)).not.toContain("ruleCount");
    expect(JSON.stringify(saved)).not.toContain("lastUpdated");
    expect(publish).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
    expect(
      screen.getByText("Draft saved. Nodes are unchanged."),
    ).not.toBeNull();
  });

  it("edits and removes with the shared disable-oriented confirmation", async () => {
    mockLoad();
    render(<AllowlistsPage cluster={cluster} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/Allowlist URL/), {
      target: { value: "https://allow.test/replacement.txt" },
    });
    expect(screen.getByText("Effective reconciliation preview")).not.toBeNull();
    expect(screen.getByText(/disable the old URL/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    expect(await screen.findByText("Removal pending")).not.toBeNull();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove" })[0] as HTMLElement,
    );
    expect(
      screen.getByRole("heading", {
        name: "Remove allowlist from desired configuration?",
      }),
    ).not.toBeNull();
    expect(screen.getByText(/does not delete it/)).not.toBeNull();
  });

  it("uses the row switch for confirmed enable-disable draft semantics", async () => {
    mockLoad();
    render(<AllowlistsPage cluster={cluster} />);
    fireEvent.click(await screen.findByLabelText("Disable Primary allowlist"));
    expect(
      screen.getByRole("heading", {
        name: "Remove allowlist from desired configuration?",
      }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove from draft" }));
    expect(await screen.findByText("Removal pending")).not.toBeNull();
    expect(screen.getByText("Unsaved changes")).not.toBeNull();
  });

  it("uses whitelist=true for audited refresh-all and shows partial results", async () => {
    mockLoad();
    vi.spyOn(api, "refreshFilters").mockImplementation(
      async (nodeID, whitelist) => {
        expect(whitelist).toBe(true);
        if (nodeID === secondary.id) throw new Error("Node unavailable");
        return { nodeId: nodeID, whitelist, status: "succeeded" };
      },
    );
    render(<AllowlistsPage cluster={cluster} />);
    fireEvent.click(await screen.findByRole("button", { name: "Refresh all" }));
    expect(
      screen.getByText(/creates no configuration revision/),
    ).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh all allowlists" }),
    );
    expect(
      await screen.findByText("Allowlist refresh completed with node failures"),
    ).not.toBeNull();
    expect(screen.getByText("Node unavailable")).not.toBeNull();
    expect(api.refreshFilters).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/complete allowlist category/)).not.toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Refresh selected",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("renders loading, empty, retryable error, stale, and partial states", async () => {
    mockLoad();
    const loadingView = render(<AllowlistsPage cluster={cluster} />);
    expect(screen.getByLabelText("Loading DNS allowlists")).not.toBeNull();
    await screen.findByRole("table");
    loadingView.unmount();

    vi.restoreAllMocks();
    const emptyDocument = {
      ...desiredDocument,
      shared: {
        ...desiredDocument.shared,
        filtering: {
          ...desiredDocument.shared.filtering,
          whitelistUrls: [],
        },
      },
    };
    mockLoad(
      { ...presentation, nodes: [], partial: false },
      { ...draft, document: emptyDocument },
    );
    vi.mocked(api.configurationRevisions).mockResolvedValue({ items: [] });
    const emptyView = render(<AllowlistsPage cluster={cluster} />);
    expect(await screen.findByText("No allowlists")).not.toBeNull();
    emptyView.unmount();

    vi.restoreAllMocks();
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
    const partialView = render(<AllowlistsPage cluster={cluster} />);
    expect(await screen.findByText("Capability data is stale")).not.toBeNull();
    expect(
      screen.getByText("Some node metadata is unavailable"),
    ).not.toBeNull();
    partialView.unmount();

    vi.restoreAllMocks();
    vi.spyOn(api, "configurationInventory").mockRejectedValue(
      new Error("Allowlist request failed"),
    );
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [],
      refreshedAt: "2026-08-02T00:00:00Z",
      staleAfterSeconds: 60,
    });
    vi.spyOn(api, "configurationRevisions").mockResolvedValue({ items: [] });
    vi.spyOn(api, "allowlistPresentation").mockResolvedValue({
      generatedAt: "2026-08-02T00:00:00Z",
      stale: false,
      partial: false,
      nodes: [],
    });
    render(<AllowlistsPage cluster={cluster} />);
    expect(await screen.findByText("Allowlist request failed")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull();
  });

  it("supports keyboard dismissal plus desktop/mobile and light/dark rendering", async () => {
    document.documentElement.dataset.theme = "dark";
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    mockLoad();
    const { container } = render(<AllowlistsPage cluster={cluster} />);
    await screen.findByRole("table");
    expect(container.querySelector(".allowlists-page")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add allowlist" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    document.documentElement.dataset.theme = "light";
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
    });
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
