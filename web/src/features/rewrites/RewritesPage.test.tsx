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
  CapabilityProfile,
  Cluster,
  ConfigurationDraft,
  DesiredConfigurationDocument,
  Node,
  Rewrite,
} from "../../lib/types";
import { RewritesPage } from "./RewritesPage";

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
  activeRevisionId: "77777777-7777-4777-8777-777777777777",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const currentRewrites: Rewrite[] = [
  { domain: "router.test", answer: "192.0.2.1", enabled: true },
  { domain: "*.service.test", answer: "target.test", enabled: false },
];

const primary = node({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Primary",
  convergenceStatus: "converged",
});
const secondary = node({
  id: "33333333-3333-4333-8333-333333333333",
  name: "Secondary",
  convergenceStatus: "converged",
});

function node(patch: Partial<Node>): Node {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    clusterId: cluster.id,
    name: "Primary",
    baseUrl: "http://node.test",
    certificatePolicy: "system",
    enabled: true,
    version: "v0.107.78",
    healthStatus: "healthy",
    compatibilityStatus: "supported",
    maintenanceMode: false,
    convergenceStatus: "converged",
    recordVersion: 1,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...patch,
  };
}

function capability(
  value: Node,
  patch: Partial<CapabilityProfile["features"]> = {},
): CapabilityProfile {
  return {
    nodeId: value.id,
    productVersion: value.version ?? "v0.107.78",
    compatibility: "supported",
    schemaVersion: 2,
    features: { rewrites: true, rewrite_toggle: true, ...patch },
    warnings: [],
    refreshedAt: "2026-08-01T00:00:00Z",
  };
}

function makeDraft(rewrites = currentRewrites): ConfigurationDraft {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    clusterId: cluster.id,
    sourceSnapshotId: "55555555-5555-4555-8555-555555555555",
    schemaVersion: 2,
    document: {
      schemaVersion: 2,
      shared: { rewritesEnabled: true, rewrites },
      nodeOverrides: {},
      unsupported: [],
    } as unknown as DesiredConfigurationDocument,
    canonicalHash: "hash",
    version: 1,
    updatedAt: "2026-08-01T00:00:00Z",
  };
}

function mockLoad({
  draft = makeDraft(),
  nodes = [primary, secondary],
  capabilities = nodes.map((value) => capability(value)),
}: {
  draft?: ConfigurationDraft;
  nodes?: Node[];
  capabilities?: CapabilityProfile[];
} = {}) {
  vi.spyOn(api, "configurationInventory").mockResolvedValue({
    schemaVersion: 2,
    snapshots: [],
    capabilities,
    draft,
  });
  vi.spyOn(api, "nodes").mockResolvedValue({
    items: nodes,
    refreshedAt: "2026-08-01T00:00:00Z",
    staleAfterSeconds: 60,
  });
}

describe("DNS rewrites page", () => {
  it("migrates existing inline rewrites into searchable table rows", async () => {
    mockLoad();
    const { container } = render(<RewritesPage cluster={cluster} />);

    expect(await screen.findByText("router.test")).not.toBeNull();
    expect(screen.getByText("*.service.test")).not.toBeNull();
    expect(container.querySelectorAll("table tbody tr")).toHaveLength(2);
    expect(container.querySelector(".repeat-row")).toBeNull();
    expect(screen.getAllByText("2/2 converged")).toHaveLength(2);
    for (const column of [
      "Domain",
      "Answer",
      "Inferred type",
      "Draft/change state",
      "Node convergence",
      "Actions",
    ])
      expect(screen.getByRole("columnheader", { name: column })).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Search rewrites"), {
      target: { value: "TARGET" },
    });
    expect(screen.queryByText("router.test")).toBeNull();
    expect(screen.getByText("*.service.test")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Search rewrites"), {
      target: { value: "missing" },
    });
    expect(screen.getByText("No rewrites match this search")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("router.test")).not.toBeNull();
  });

  it("adds valid IPv4 and CNAME rewrites with inferred types", async () => {
    mockLoad();
    render(<RewritesPage cluster={cluster} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add Rewrite" }));
    let dialog = screen.getByRole("dialog", { name: "Add DNS Rewrite" });
    fireEvent.change(within(dialog).getByLabelText(/Domain or wildcard/), {
      target: { value: "nas.test" },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Answer/), {
      target: { value: "198.51.100.8" },
    });
    expect(within(dialog).getByText("A")).not.toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add to Draft" }),
    );
    expect(await screen.findByText("nas.test")).not.toBeNull();
    expect(screen.getByText("Added")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add Rewrite" }));
    dialog = screen.getByRole("dialog", { name: "Add DNS Rewrite" });
    fireEvent.change(within(dialog).getByLabelText(/Domain or wildcard/), {
      target: { value: "alias.test" },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Answer/), {
      target: { value: "target.test" },
    });
    expect(within(dialog).getByText("CNAME")).not.toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add to Draft" }),
    );
    expect(await screen.findByText("alias.test")).not.toBeNull();
  });

  it("rejects invalid domains, answers, and duplicate pairs inline", async () => {
    mockLoad();
    render(<RewritesPage cluster={cluster} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add Rewrite" }));
    const dialog = screen.getByRole("dialog", { name: "Add DNS Rewrite" });
    const add = within(dialog).getByRole("button", { name: "Add to Draft" });
    expect((add as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(/Domain or wildcard/), {
      target: { value: "bad.*.test" },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Answer/), {
      target: { value: "192.0.2.0/24" },
    });
    expect(
      within(dialog).getByText(/valid hostname or a wildcard beginning/),
    ).not.toBeNull();
    expect(within(dialog).getByText(/valid IPv4 address/)).not.toBeNull();

    fireEvent.change(within(dialog).getByLabelText(/Domain or wildcard/), {
      target: { value: "ROUTER.TEST" },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Answer/), {
      target: { value: "192.0.2.1" },
    });
    expect(
      within(dialog).getByText(/pair already exists in the draft/),
    ).not.toBeNull();
    expect((add as HTMLButtonElement).disabled).toBe(true);
  });

  it("edits a rewrite and saves the draft without publishing or deploying", async () => {
    const draft = makeDraft();
    mockLoad({ draft });
    const update = vi
      .spyOn(api, "updateConfigurationDraft")
      .mockImplementation(async (_clusterID, _version, document) => ({
        draft: { ...draft, version: 2, document },
        issues: [],
      }));
    const publish = vi.spyOn(api, "publishConfigurationRevision");
    const deploy = vi.spyOn(api, "startDeployment");
    render(<RewritesPage cluster={cluster} />);

    fireEvent.click(await screen.findByLabelText("Enable DNS rewrites"));
    fireEvent.click(screen.getByLabelText("Edit router.test to 192.0.2.1"));
    const dialog = screen.getByRole("dialog", { name: "Edit DNS Rewrite" });
    fireEvent.change(within(dialog).getByLabelText(/^Answer/), {
      target: { value: "192.0.2.9" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Update Draft" }),
    );
    expect(screen.getByText("192.0.2.9")).not.toBeNull();
    expect(screen.getByText("Modified")).not.toBeNull();
    expect(update).not.toHaveBeenCalled();

    const saveButton = screen.getAllByRole("button", { name: "Save Draft" })[0];
    if (saveButton === undefined) throw new Error("Save Draft action missing");
    fireEvent.click(saveButton);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0]?.[2].shared.rewrites[0]?.answer).toBe(
      "192.0.2.9",
    );
    expect(update.mock.calls[0]?.[2].shared.rewritesEnabled).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
    expect(
      screen.getByText("Draft saved. Nodes are unchanged."),
    ).not.toBeNull();
  });

  it("confirms deletion and keeps it draft-only until Save Draft", async () => {
    const draft = makeDraft();
    mockLoad({ draft });
    const update = vi
      .spyOn(api, "updateConfigurationDraft")
      .mockImplementation(async (_clusterID, _version, document) => ({
        draft: { ...draft, version: 2, document },
        issues: [],
      }));
    const publish = vi.spyOn(api, "publishConfigurationRevision");
    const deploy = vi.spyOn(api, "startDeployment");
    render(<RewritesPage cluster={cluster} />);

    fireEvent.click(
      await screen.findByLabelText("Delete router.test to 192.0.2.1"),
    );
    const dialog = screen.getByRole("dialog", { name: "Delete router.test?" });
    expect(
      within(dialog).getByText(/will not be deleted from any/),
    ).not.toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete from Draft" }),
    );
    expect(screen.queryByText("router.test")).toBeNull();
    expect(screen.getByText(/router.test → 192.0.2.1/)).not.toBeNull();
    expect(update).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();

    const saveButton = screen.getAllByRole("button", { name: "Save Draft" })[0];
    if (saveButton === undefined) throw new Error("Save Draft action missing");
    fireEvent.click(saveButton);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0]?.[2].shared.rewrites).toEqual([
      currentRewrites[1],
    ]);
  });

  it("warns about older nodes and preserves unsupported enablement controls", async () => {
    const olderSecondary = { ...secondary, version: "v0.107.67" };
    mockLoad({
      nodes: [primary, olderSecondary],
      capabilities: [
        capability(primary),
        capability(olderSecondary, { rewrite_toggle: false }),
      ],
    });
    render(<RewritesPage cluster={cluster} />);

    expect(
      await screen.findByText("Rewrite enablement unavailable on older nodes"),
    ).not.toBeNull();
    expect(
      screen.getByText(/Secondary lacks the rewrite settings endpoint/),
    ).not.toBeNull();
    expect(
      (screen.getByLabelText("Enable DNS rewrites") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Edit router.test to 192.0.2.1"));
    expect(
      (screen.getByLabelText("Enable this rewrite") as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  it("renders loading, empty, retryable error, unsupported, and partial states", async () => {
    mockLoad({ draft: makeDraft([]) });
    const emptyView = render(<RewritesPage cluster={cluster} />);
    expect(screen.getByLabelText("Loading DNS rewrites")).not.toBeNull();
    expect(await screen.findByText("No DNS rewrites")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Add Rewrite" })).toHaveLength(
      2,
    );
    emptyView.unmount();

    vi.restoreAllMocks();
    const legacyDraft = makeDraft();
    legacyDraft.document.schemaVersion = 1;
    mockLoad({ draft: legacyDraft });
    const unsupportedView = render(<RewritesPage cluster={cluster} />);
    expect(await screen.findByText("Unsupported draft format")).not.toBeNull();
    unsupportedView.unmount();

    vi.restoreAllMocks();
    mockLoad({
      nodes: [primary, { ...secondary, convergenceStatus: "drifted" }],
      capabilities: [capability(primary)],
    });
    const partialView = render(<RewritesPage cluster={cluster} />);
    expect(
      await screen.findByText("Rewrite capability data is partial"),
    ).not.toBeNull();
    expect(screen.getAllByText("1 drifted").length).toBeGreaterThan(0);
    partialView.unmount();

    vi.restoreAllMocks();
    vi.spyOn(api, "configurationInventory").mockRejectedValue(
      new Error("Inventory failed"),
    );
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [],
      refreshedAt: "2026-08-01T00:00:00Z",
      staleAfterSeconds: 60,
    });
    render(<RewritesPage cluster={cluster} />);
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
      const { container } = render(<RewritesPage cluster={cluster} />);
      fireEvent.click(
        await screen.findByRole("button", { name: "Add Rewrite" }),
      );
      const dialog = screen.getByRole("dialog", { name: "Add DNS Rewrite" });
      await waitFor(() =>
        expect(document.activeElement).toBe(
          within(dialog).getByLabelText(/Domain or wildcard/),
        ),
      );
      expect(container.querySelector(".data-table")).not.toBeNull();
      expect(document.documentElement.dataset.theme).toBe(theme);
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(
        screen.queryByRole("dialog", { name: "Add DNS Rewrite" }),
      ).toBeNull();
    },
  );
});
