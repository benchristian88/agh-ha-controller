// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import type {
  CapabilityProfile,
  Cluster,
  ConfigurationDraft,
  DesiredConfigurationDocument,
  Node,
} from "../../lib/types";
import { CustomRulesPage } from "./CustomRulesPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
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

const primary: Node = {
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
  convergenceStatus: "converged",
  recordVersion: 1,
  createdAt: "2026-08-02T00:00:00Z",
  updatedAt: "2026-08-02T00:00:00Z",
};

const secondary: Node = {
  ...primary,
  id: "33333333-3333-4333-8333-333333333333",
  name: "Secondary",
};

const document = {
  schemaVersion: 2,
  shared: {
    dns: {},
    filtering: {
      enabled: true,
      updateIntervalHours: 24,
      filterUrls: [],
      whitelistUrls: [],
      userRules: ["||ads.example^", "@@||allowed.example^"],
    },
    clients: [],
    rewritesEnabled: true,
    rewrites: [],
    services: {},
    queryLog: {},
    statistics: {},
  },
  nodeOverrides: {},
  unsupported: [],
} as unknown as DesiredConfigurationDocument;

const draft: ConfigurationDraft = {
  id: "44444444-4444-4444-8444-444444444444",
  clusterId: cluster.id,
  sourceSnapshotId: "55555555-5555-4555-8555-555555555555",
  schemaVersion: 2,
  document,
  canonicalHash: "draft-hash",
  version: 4,
  updatedAt: "2026-08-02T00:00:00Z",
};

function profile(node: Node, context = true): CapabilityProfile {
  return {
    nodeId: node.id,
    productVersion: node.version ?? "",
    compatibility: "supported",
    schemaVersion: 2,
    features: {
      filtering: true,
      test_host_filtering: true,
      test_host_filtering_context: context,
    },
    warnings: [],
    refreshedAt: "2026-08-02T00:00:00Z",
  };
}

function mockLoad(capabilities = [profile(primary), profile(secondary)]) {
  vi.spyOn(api, "configurationInventory").mockResolvedValue({
    schemaVersion: 2,
    snapshots: [],
    capabilities,
    draft,
  });
  vi.spyOn(api, "nodes").mockResolvedValue({
    items: [primary, secondary],
    refreshedAt: "2026-08-02T00:00:00Z",
    staleAfterSeconds: 60,
  });
}

describe("Custom Filter Rules", () => {
  it("tests optional client and query context across explicit fleet scope with node-attributed partial results", async () => {
    mockLoad();
    const update = vi.spyOn(api, "updateConfigurationDraft");
    const run = vi.spyOn(api, "testHostFiltering").mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666",
      clusterId: cluster.id,
      clusterName: cluster.name,
      command: "test_host_filtering",
      target: { scope: "all_compatible_enabled_nodes" },
      status: "partial_success",
      requestId: "request-host",
      requestedAt: "2026-08-02T00:00:00Z",
      excludedNodes: [],
      nodeResults: [
        {
          id: "result-a",
          nodeId: primary.id,
          nodeName: primary.name,
          position: 1,
          status: "succeeded",
          hostFilterResult: {
            matched: true,
            reason: "FilteredBlackList",
            rules: [{ text: "||ads.example^", filterListId: 42 }],
          },
        },
        {
          id: "result-b",
          nodeId: secondary.id,
          nodeName: secondary.name,
          position: 2,
          status: "failed",
          errorCode: "NODE_UNREACHABLE",
        },
      ],
    });
    const user = userEvent.setup();
    render(<CustomRulesPage cluster={cluster} />);
    await user.click(
      await screen.findByRole("button", { name: "Test a host" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Test host filtering" });
    await user.type(within(dialog).getByLabelText(/Hostname/), "ads.example");
    await user.type(within(dialog).getByLabelText(/Client/), "192.0.2.10");
    await user.selectOptions(
      within(dialog).getByLabelText(/Query type/),
      "AAAA",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Target scope"),
      "all_compatible_enabled_nodes",
    );
    expect(
      within(dialog).getByText("All compatible enabled nodes (2)"),
    ).not.toBeNull();
    await user.click(
      within(dialog).getByRole("button", { name: "Test host filtering" }),
    );
    await waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(run.mock.calls[0]?.[1]).toEqual({
      scope: "all_compatible_enabled_nodes",
    });
    expect(run.mock.calls[0]?.[2]).toEqual({
      hostname: "ads.example",
      client: "192.0.2.10",
      queryType: "AAAA",
    });
    expect(
      await screen.findByText("Host filtering test partially completed"),
    ).not.toBeNull();
    expect(screen.getByText("FilteredBlackList")).not.toBeNull();
    expect(screen.getByText("||ads.example^")).not.toBeNull();
    expect(screen.getAllByText(/NODE_UNREACHABLE/).length).toBeGreaterThan(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps the default scope narrow, validates before submission, and excludes unsupported contextual targets", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    mockLoad([profile(primary), profile(secondary, false)]);
    const user = userEvent.setup();
    render(<CustomRulesPage cluster={cluster} />);
    await user.click(
      await screen.findByRole("button", { name: "Test a host" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Test host filtering" });
    const confirm = within(dialog).getByRole("button", {
      name: "Test host filtering",
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(within(dialog).getAllByText("Selected node").length).toBeGreaterThan(
      0,
    );
    expect(within(dialog).getAllByText("Primary").length).toBeGreaterThan(0);
    fireEvent.change(within(dialog).getByLabelText(/Hostname/), {
      target: { value: "https://bad.example/path" },
    });
    expect(within(dialog).getByText(/without a URL scheme/)).not.toBeNull();
    fireEvent.change(within(dialog).getByLabelText(/Hostname/), {
      target: { value: "example.org" },
    });
    await user.selectOptions(within(dialog).getByLabelText(/Query type/), "A");
    expect(within(dialog).getAllByText("Primary").length).toBeGreaterThan(0);
    expect(within(dialog).queryByText("Secondary")).toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("saves ordered rules separately and does not restore a completed successful test", async () => {
    mockLoad();
    const update = vi
      .spyOn(api, "updateConfigurationDraft")
      .mockImplementation(async (_clusterID, _version, nextDocument) => ({
        draft: { ...draft, version: 5, document: nextDocument },
        issues: [],
      }));
    window.sessionStorage.setItem(
      `aghha-host-filter-operation:${cluster.id}`,
      JSON.stringify({
        id: "successful-operation",
        input: { hostname: "ads.example", client: "", queryType: "" },
      }),
    );
    vi.spyOn(api, "dnsOperation").mockResolvedValue({
      id: "successful-operation",
      clusterId: cluster.id,
      clusterName: cluster.name,
      command: "test_host_filtering",
      target: { scope: "node", nodeId: primary.id },
      status: "succeeded",
      requestId: "request-success",
      requestedAt: "2026-08-02T00:00:00Z",
      completedAt: "2026-08-02T00:00:01Z",
      excludedNodes: [],
      nodeResults: [],
    });
    const user = userEvent.setup();
    render(<CustomRulesPage cluster={cluster} />);
    const editor = (await screen.findByLabelText(
      "Rules",
    )) as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: { value: "# keep order\n||new.example^\n@@||allowed.example^" },
    });
    await user.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0]?.[2].shared.filtering.userRules).toEqual([
      "# keep order",
      "||new.example^",
      "@@||allowed.example^",
    ]);
    await waitFor(() =>
      expect(
        window.sessionStorage.getItem(
          `aghha-host-filter-operation:${cluster.id}`,
        ),
      ).toBeNull(),
    );
    expect(screen.queryByText("Host filtering test result")).toBeNull();
  });
});
