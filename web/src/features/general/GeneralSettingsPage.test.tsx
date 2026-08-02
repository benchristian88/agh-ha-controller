// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import type {
  CapabilityProfile,
  Cluster,
  ConfigurationDraft,
  ConfigurationRevision,
  DesiredConfigurationDocument,
  Node,
} from "../../lib/types";
import { GeneralSettingsPage } from "./GeneralSettingsPage";
import { DAY_MILLIS, HOUR_MILLIS } from "./model";

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
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const secondary: Node = {
  ...primary,
  id: "33333333-3333-4333-8333-333333333333",
  name: "Secondary",
  version: "v0.107.53",
};

const desiredDocument = {
  schemaVersion: 2,
  shared: {
    dns: { protectionEnabled: true },
    filtering: {
      enabled: true,
      updateIntervalHours: 5,
      filterUrls: [],
      whitelistUrls: [],
      userRules: [],
    },
    clients: [],
    rewritesEnabled: true,
    rewrites: [],
    services: {
      blockedServiceIds: [],
      blockedSchedule: { timeZone: "Local", days: {} },
      safeBrowsing: true,
      parentalControl: false,
      safeSearch: {
        enabled: true,
        bing: true,
        duckDuckGo: false,
        ecosia: true,
        google: true,
        pixabay: false,
        yandex: true,
        youTube: true,
      },
    },
    queryLog: {
      enabled: true,
      intervalMillis: HOUR_MILLIS + 1,
      anonymizeClientIp: true,
      ignored: ["health.example"],
      ignoredEnabled: false,
    },
    statistics: {
      enabled: true,
      intervalMillis: 13 * HOUR_MILLIS,
      ignored: ["metrics.example"],
      ignoredEnabled: true,
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
  canonicalHash: "draft-hash",
  version: 4,
  updatedAt: "2026-08-01T00:00:00Z",
};

const activeRevision = {
  id: cluster.activeRevisionId,
  clusterId: cluster.id,
  revisionNumber: 12,
  schemaVersion: 2,
  document: desiredDocument,
  canonicalHash: "active-hash",
  summary: "Active",
  createdBy: "user",
  createdAt: "2026-08-01T00:00:00Z",
  active: true,
} as ConfigurationRevision;

function profile(
  node: Node,
  features: Record<string, boolean>,
): CapabilityProfile {
  return {
    nodeId: node.id,
    productVersion: node.version ?? "",
    compatibility: "supported",
    schemaVersion: 2,
    features,
    warnings: [],
    refreshedAt: "2026-08-01T00:00:00Z",
  };
}

function mockLoad(overrides?: {
  draft?: ConfigurationDraft;
  capabilities?: CapabilityProfile[];
}) {
  vi.spyOn(api, "configurationInventory").mockResolvedValue({
    schemaVersion: 2,
    snapshots: [],
    capabilities: overrides?.capabilities ?? [
      profile(primary, {
        filter_interval_arbitrary: true,
        safe_search_ecosia: true,
        ignored_lists_toggle: true,
      }),
      profile(secondary, {
        filter_interval_arbitrary: false,
        safe_search_ecosia: false,
        ignored_lists_toggle: false,
      }),
    ],
    draft: overrides && "draft" in overrides ? overrides.draft : draft,
  });
  vi.spyOn(api, "nodes").mockResolvedValue({
    items: [primary, secondary],
    refreshedAt: "2026-08-01T00:00:00Z",
    staleAfterSeconds: 60,
  });
  vi.spyOn(api, "configurationRevisions").mockResolvedValue({
    items: [activeRevision],
  });
}

describe("General Settings", () => {
  it("loads preset and custom values without conversion loss", async () => {
    mockLoad();
    const update = vi
      .spyOn(api, "updateConfigurationDraft")
      .mockImplementation(async (_clusterID, _version, nextDocument) => ({
        draft: { ...draft, version: 5, document: nextDocument },
        issues: [],
      }));
    render(<GeneralSettingsPage cluster={cluster} />);

    expect(await screen.findByText("Revision #12")).not.toBeNull();
    expect(screen.getByText("Version 4")).not.toBeNull();
    expect(screen.getByText("2")).not.toBeNull();
    expect(
      (screen.getByLabelText("Filter update interval") as HTMLSelectElement)
        .value,
    ).toBe("custom");
    expect(
      (
        screen.getByLabelText(
          "Custom filter update interval",
        ) as HTMLInputElement
      ).value,
    ).toBe("5");
    expect(
      (screen.getByLabelText("Custom query log retention") as HTMLInputElement)
        .value,
    ).toBe(String(HOUR_MILLIS + 1));
    expect(
      (
        screen.getByLabelText(
          "Custom query log retention unit",
        ) as HTMLSelectElement
      ).value,
    ).toBe("1");
    expect(
      (screen.getByLabelText("Custom statistics retention") as HTMLInputElement)
        .value,
    ).toBe("13");
    expect(
      (
        screen.getByLabelText(
          "Custom statistics retention unit",
        ) as HTMLSelectElement
      ).value,
    ).toBe(String(HOUR_MILLIS));

    fireEvent.change(screen.getByLabelText("Custom query log retention unit"), {
      target: { value: String(DAY_MILLIS) },
    });
    fireEvent.click(screen.getByLabelText("Protection enabled"));
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update.mock.calls[0]?.[2].shared.queryLog.intervalMillis).toBe(
      HOUR_MILLIS + 1,
    );
    expect(update.mock.calls[0]?.[2].shared.statistics.intervalMillis).toBe(
      13 * HOUR_MILLIS,
    );
  });

  it("maps presets, Statistics ignored state, providers, and Save Draft only", async () => {
    mockLoad({
      capabilities: [
        profile(primary, {
          filter_interval_arbitrary: true,
          safe_search_ecosia: true,
          ignored_lists_toggle: true,
        }),
        profile(secondary, {
          filter_interval_arbitrary: true,
          safe_search_ecosia: true,
          ignored_lists_toggle: true,
        }),
      ],
    });
    const update = vi
      .spyOn(api, "updateConfigurationDraft")
      .mockImplementation(async (_clusterID, _version, nextDocument) => ({
        draft: { ...draft, version: 5, document: nextDocument },
        issues: [],
      }));
    const publish = vi.spyOn(api, "publishConfigurationRevision");
    const deploy = vi.spyOn(api, "startDeployment");
    render(<GeneralSettingsPage cluster={cluster} />);

    await screen.findByText("Query Log policy");
    fireEvent.change(screen.getByLabelText("Query Log retention"), {
      target: { value: String(7 * DAY_MILLIS) },
    });
    fireEvent.click(screen.getByLabelText("Apply Statistics ignored domains"));
    fireEvent.click(screen.getByLabelText("DuckDuckGo"));
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));

    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    const savedDocument = update.mock.calls[0]?.[2];
    expect(savedDocument?.shared.queryLog.intervalMillis).toBe(7 * DAY_MILLIS);
    expect(savedDocument?.shared.queryLog.ignoredEnabled).toBe(false);
    expect(savedDocument?.shared.statistics.ignoredEnabled).toBe(false);
    expect(savedDocument?.shared.services.safeSearch.duckDuckGo).toBe(true);
    expect(publish).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Draft saved. Nodes are unchanged."),
    ).not.toBeNull();
  });

  it("validates domains inline and keeps invalid rows out of Save Draft", async () => {
    mockLoad();
    const update = vi.spyOn(api, "updateConfigurationDraft");
    render(<GeneralSettingsPage cluster={cluster} />);

    const row = await screen.findByLabelText(
      "Query Log ignored domains entry 1",
    );
    fireEvent.change(row, { target: { value: "bad domain" } });
    expect(screen.getByText("Enter a valid domain name.")).not.toBeNull();
    expect(
      (screen.getByRole("button", { name: "Save Draft" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it("groups provider controls and explains version and future-release boundaries", async () => {
    mockLoad();
    render(<GeneralSettingsPage cluster={cluster} />);

    expect(await screen.findByText("Safe Search providers")).not.toBeNull();
    expect(screen.getByLabelText("DuckDuckGo")).not.toBeNull();
    expect(screen.getByLabelText("YouTube")).not.toBeNull();
    expect((screen.getByLabelText("Ecosia") as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(/Ecosia cannot be changed/)).not.toBeNull();
    expect(
      screen.getByText(
        /combined, node-attributed Query Log arrives in Release 0.6/,
      ),
    ).not.toBeNull();
    expect(
      screen.getByText(/Cluster statistics aggregation arrives in Release 0.5/),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /Clear Query Log/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Reset Statistics/i }),
    ).toBeNull();
  });

  it("supports keyboard controls and light/dark/mobile-safe shared layout", async () => {
    mockLoad();
    document.documentElement.dataset.theme = "light";
    Object.defineProperty(window, "innerWidth", {
      value: 1440,
      configurable: true,
    });
    const desktop = render(<GeneralSettingsPage cluster={cluster} />);
    expect(await screen.findByText("Protection and filtering")).not.toBeNull();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(
      desktop.container.querySelector(".page-container--standard"),
    ).not.toBeNull();
    desktop.unmount();

    document.documentElement.dataset.theme = "dark";
    Object.defineProperty(window, "innerWidth", {
      value: 390,
      configurable: true,
    });
    const user = userEvent.setup();
    const { container } = render(<GeneralSettingsPage cluster={cluster} />);

    const protection = await screen.findByLabelText("Protection enabled");
    protection.focus();
    await user.keyboard(" ");
    expect((protection as HTMLInputElement).checked).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(container.querySelector(".page-container--standard")).not.toBeNull();
  });

  it("renders loading, retryable error, and missing-draft states", async () => {
    vi.spyOn(api, "configurationInventory").mockReturnValue(
      new Promise(() => undefined),
    );
    vi.spyOn(api, "nodes").mockReturnValue(new Promise(() => undefined));
    vi.spyOn(api, "configurationRevisions").mockReturnValue(
      new Promise(() => undefined),
    );
    const loading = render(<GeneralSettingsPage cluster={cluster} />);
    expect(screen.getByLabelText("Loading General Settings")).not.toBeNull();
    loading.unmount();

    vi.restoreAllMocks();
    vi.spyOn(api, "configurationInventory").mockRejectedValue(
      new Error("General request failed"),
    );
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [],
      refreshedAt: "",
      staleAfterSeconds: 60,
    });
    vi.spyOn(api, "configurationRevisions").mockResolvedValue({ items: [] });
    const failed = render(<GeneralSettingsPage cluster={cluster} />);
    expect(await screen.findByText("General request failed")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull();
    failed.unmount();

    vi.restoreAllMocks();
    mockLoad({ draft: undefined });
    const missing = render(<GeneralSettingsPage cluster={cluster} />);
    expect(
      await screen.findByText("Import a node configuration first"),
    ).not.toBeNull();
    missing.unmount();

    vi.restoreAllMocks();
    mockLoad({
      draft: {
        ...draft,
        schemaVersion: 1,
        document: { ...desiredDocument, schemaVersion: 1 },
      },
    });
    render(<GeneralSettingsPage cluster={cluster} />);
    expect(await screen.findByText("Unsupported draft format")).not.toBeNull();
  });
});
