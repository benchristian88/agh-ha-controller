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
  Cluster,
  ConfigurationDocument,
  ConfigurationDraft,
  DesiredConfigurationDocument,
  Node,
} from "../../lib/types";
import { DHCPPage } from "./DHCPPage";

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

const node: Node = {
  id: "22222222-2222-4222-8222-222222222222",
  clusterId: cluster.id,
  name: "Primary",
  baseUrl: "http://node.test",
  certificatePolicy: "system",
  enabled: true,
  maintenanceMode: false,
  healthStatus: "healthy",
  compatibilityStatus: "supported",
  convergenceStatus: "converged",
  recordVersion: 1,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const secondary: Node = {
  ...node,
  id: "33333333-3333-4333-8333-333333333333",
  name: "Secondary",
  baseUrl: "http://secondary.test",
};

function makeDraft(interfaceName = "legacy0"): ConfigurationDraft {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    clusterId: cluster.id,
    sourceSnapshotId: "55555555-5555-4555-8555-555555555555",
    schemaVersion: 2,
    document: {
      schemaVersion: 2,
      shared: {},
      nodeOverrides: {
        [node.id]: {
          bindHosts: ["192.0.2.2"],
          dnsPort: 53,
          dhcp: {
            enabled: true,
            interfaceName,
            ipv4: {
              gateway: "192.0.2.1",
              subnetMask: "255.255.255.0",
              rangeStart: "192.0.2.100",
              rangeEnd: "192.0.2.200",
              leaseDurationSeconds: 86_400,
            },
            ipv6: { rangeStart: "", leaseDurationSeconds: 0 },
            staticLeases: [
              {
                mac: "00:11:22:33:44:55",
                ip: "192.0.2.10",
                hostname: "printer",
              },
            ],
          },
        },
      },
      unsupported: [],
    } as unknown as DesiredConfigurationDocument,
    canonicalHash: "hash",
    version: 1,
    updatedAt: "2026-08-01T00:00:00Z",
  };
}

function observedDocument(): ConfigurationDocument {
  const nodeSpecific = makeDraft().document.nodeOverrides[node.id];
  if (!nodeSpecific)
    throw new Error("test draft must include its node override");
  return {
    schemaVersion: 2,
    nodeSpecific: { ...nodeSpecific },
    observedOnly: {
      productVersion: "v0.107.78",
      tls: {} as ConfigurationDocument["observedOnly"]["tls"],
      dhcpLeases: [
        {
          mac: "aa:bb:cc:dd:ee:ff",
          ip: "192.0.2.120",
          hostname: "laptop",
          expiresAt: "2026-08-03T00:00:00Z",
        },
      ],
    },
    shared: {} as ConfigurationDocument["shared"],
    unsupported: [],
  };
}

function mockLoad({
  interfaceError,
  emptyInterfaces = false,
  draft = makeDraft(),
}: {
  interfaceError?: Error;
  emptyInterfaces?: boolean;
  draft?: ConfigurationDraft;
} = {}) {
  vi.spyOn(api, "configurationInventory").mockResolvedValue({
    schemaVersion: 2,
    draft,
    capabilities: [],
    snapshots: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        nodeId: node.id,
        observedAt: "2026-08-01T00:00:00Z",
        schemaVersion: 2,
        document: observedDocument(),
        collectionStatus: "succeeded",
      },
    ],
  });
  vi.spyOn(api, "nodes").mockResolvedValue({
    items: [node],
    refreshedAt: "2026-08-02T00:00:00Z",
    staleAfterSeconds: 60,
  });
  vi.spyOn(api, "dhcpOperations").mockResolvedValue({ items: [] });
  const interfaces = vi.spyOn(api, "dhcpInterfaces");
  if (interfaceError) interfaces.mockRejectedValue(interfaceError);
  else
    interfaces.mockResolvedValue({
      nodeId: node.id,
      nodeName: node.name,
      fetchedAt: "2026-08-02T00:00:00Z",
      interfaces: emptyInterfaces
        ? []
        : [
            {
              name: "eth0",
              hardwareAddress: "00:11:22:33:44:55",
              ipv4Addresses: ["192.0.2.2"],
              ipv6Addresses: [],
              gatewayIp: "192.0.2.1",
              flags: ["up"],
              available: true,
            },
          ],
    });
}

describe("DHCP page", () => {
  it("renders explicit node scope, active leases, freshness, and preserved legacy interfaces", async () => {
    mockLoad();
    const { container } = render(<DHCPPage cluster={cluster} />);
    expect(
      await screen.findByRole("heading", { name: "Primary DHCP" }),
    ).not.toBeNull();
    expect(
      await screen.findByText("Legacy interface not discovered"),
    ).not.toBeNull();
    expect(
      (screen.getByLabelText(/Network interface/) as HTMLSelectElement).value,
    ).toBe("legacy0");
    expect(screen.getByText("laptop")).not.toBeNull();
    expect(screen.getByText("Stale observation")).not.toBeNull();
    expect(container.querySelectorAll("table")).toHaveLength(2);
    expect(screen.getByText(/Observed-only runtime leases/)).not.toBeNull();
    expect(screen.getByText("Maintenance mode required")).not.toBeNull();
  });

  it("uses accessible strongly confirmed node-scoped destructive dialogs", async () => {
    mockLoad({ draft: makeDraft("eth0") });
    vi.mocked(api.nodes).mockResolvedValue({
      items: [{ ...node, maintenanceMode: true }],
      refreshedAt: "2026-08-02T00:00:00Z",
      staleAfterSeconds: 60,
    });
    render(<DHCPPage cluster={cluster} />);
    const open = await screen.findByRole("button", {
      name: "Reset DHCP configuration",
    });
    fireEvent.click(open);
    let dialog = screen.getByRole("dialog", {
      name: "Reset DHCP configuration",
    });
    expect(within(dialog).getByText("Exact node")).not.toBeNull();
    expect(within(dialog).getByText("Primary")).not.toBeNull();
    expect(within(dialog).getByText("Current cluster")).not.toBeNull();
    expect(within(dialog).getByText("Home")).not.toBeNull();
    expect(within(dialog).getByText("Consequence")).not.toBeNull();
    expect(within(dialog).getByText("Recoverable")).not.toBeNull();
    expect(
      within(dialog).getByText(/not Save Draft, Publish, or Deploy/),
    ).not.toBeNull();
    const confirm = within(dialog).getByRole("button", {
      name: "Reset DHCP configuration",
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(open);
    dialog = screen.getByRole("dialog", {
      name: "Reset DHCP configuration",
    });
    await userEvent.type(
      within(dialog).getByLabelText(/Type RESET DHCP CONFIGURATION/),
      "RESET DHCP CONFIGURATION",
    );
    expect(
      (
        within(dialog).getByRole("button", {
          name: "Reset DHCP configuration",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(within(dialog).queryByText(/entire cluster/i)).toBeNull();
  });

  it("blocks destructive commands under Enforce reconciliation", async () => {
    mockLoad({ draft: makeDraft("eth0") });
    vi.mocked(api.nodes).mockResolvedValue({
      items: [{ ...node, maintenanceMode: true }],
      refreshedAt: "2026-08-02T00:00:00Z",
      staleAfterSeconds: 60,
    });
    render(
      <DHCPPage cluster={{ ...cluster, reconciliationPolicy: "enforce" }} />,
    );
    expect(
      await screen.findByText("Enforce reconciliation must be paused"),
    ).not.toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Reset DHCP configuration",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Reset DHCP leases",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("submits one reset, refreshes observation, and renders durable request and audit references", async () => {
    mockLoad({ draft: makeDraft("eth0") });
    vi.mocked(api.nodes).mockResolvedValue({
      items: [{ ...node, maintenanceMode: true }],
      refreshedAt: "2026-08-02T00:00:00Z",
      staleAfterSeconds: 60,
    });
    const operation = {
      id: "77777777-7777-4777-8777-777777777777",
      clusterId: cluster.id,
      clusterName: cluster.name,
      command: "dhcp_reset_leases" as const,
      status: "succeeded" as const,
      requestId: "88888888-8888-4888-8888-888888888888",
      observationStatus: "succeeded" as const,
      observationSnapshotId: "99999999-9999-4999-8999-999999999999",
      auditReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      requestedAt: "2026-08-02T00:00:00Z",
      completedAt: "2026-08-02T00:00:01Z",
      nodeResults: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          nodeId: node.id,
          nodeName: node.name,
          status: "succeeded" as const,
          startedAt: "2026-08-02T00:00:00Z",
          completedAt: "2026-08-02T00:00:01Z",
        },
      ],
    };
    vi.mocked(api.dhcpOperations)
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValue({ items: [operation] });
    let resolveReset: (value: typeof operation) => void = () => undefined;
    const reset = vi.spyOn(api, "resetDhcpLeases").mockReturnValue(
      new Promise((resolve) => {
        resolveReset = resolve;
      }),
    );
    render(<DHCPPage cluster={cluster} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Reset DHCP leases" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Reset DHCP leases",
    });
    await userEvent.type(
      within(dialog).getByLabelText(/Type RESET DHCP LEASES/),
      "RESET DHCP LEASES",
    );
    const confirm = within(dialog).getByRole("button", {
      name: "Reset DHCP leases",
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith(
      node.id,
      "RESET_LEASES",
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    resolveReset(operation);
    expect(await screen.findByText(operation.requestId)).not.toBeNull();
    expect(screen.getByText(operation.auditReference)).not.toBeNull();
    expect(api.configurationInventory).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("table", {
        name: "DHCP operational results for Primary",
      }),
    ).not.toBeNull();
  });

  it("preserves the imported interface when discovery is unreachable", async () => {
    mockLoad({ interfaceError: new Error("unreachable") });
    render(<DHCPPage cluster={cluster} />);
    expect(
      await screen.findByText("Using preserved interface value"),
    ).not.toBeNull();
    expect(
      (screen.getByLabelText(/Network interface/) as HTMLSelectElement).value,
    ).toBe("legacy0");
    expect(screen.getAllByText("legacy0").length).toBeGreaterThan(0);
  });

  it("runs the audited non-mutating active check for the explicit target", async () => {
    mockLoad({ draft: makeDraft("eth0") });
    const check = vi.spyOn(api, "checkActiveDhcp").mockResolvedValue({
      nodeId: node.id,
      nodeName: node.name,
      interfaceName: "eth0",
      status: "none",
      ipv4: { status: "no" },
      ipv4StaticIp: { status: "yes" },
      ipv6: { status: "no" },
      checkedAt: "2026-08-02T00:00:00Z",
    });
    render(<DHCPPage cluster={cluster} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Check for active DHCP" }),
    );
    expect(
      await screen.findByText("No other active DHCP server detected"),
    ).not.toBeNull();
    expect(check).toHaveBeenCalledWith(node.id, "eth0");
  });

  it("renders partial active-check results without changing the draft", async () => {
    mockLoad({ draft: makeDraft("eth0") });
    const save = vi.spyOn(api, "updateConfigurationDraft");
    vi.spyOn(api, "checkActiveDhcp").mockResolvedValue({
      nodeId: node.id,
      nodeName: node.name,
      interfaceName: "eth0",
      status: "partial",
      ipv4: { status: "error", message: "Safe check failure" },
      ipv4StaticIp: { status: "unavailable" },
      ipv6: { status: "no" },
      checkedAt: "2026-08-02T00:00:00Z",
    });
    render(<DHCPPage cluster={cluster} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Check for active DHCP" }),
    );
    expect(
      await screen.findByText("The check returned a partial result"),
    ).not.toBeNull();
    expect(
      screen.getByText("Check failed · Safe check failure"),
    ).not.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps one designated node while presenting a planned handoff", async () => {
    const draft = makeDraft("eth0");
    const primaryOverride = draft.document.nodeOverrides[node.id];
    if (!primaryOverride?.dhcp)
      throw new Error("test draft must include primary DHCP");
    draft.document.nodeOverrides[secondary.id] = {
      ...primaryOverride,
      bindHosts: ["192.0.2.3"],
      dhcp: { ...primaryOverride.dhcp, enabled: false },
    };
    mockLoad({ draft });
    vi.mocked(api.nodes).mockResolvedValue({
      items: [node, secondary],
      refreshedAt: "2026-08-02T00:00:00Z",
      staleAfterSeconds: 60,
    });
    render(<DHCPPage cluster={cluster} />);
    const toggles = await screen.findAllByLabelText(
      "Designated active DHCP node",
    );
    const [primaryToggle, secondaryToggle] = toggles as HTMLInputElement[];
    if (!primaryToggle || !secondaryToggle)
      throw new Error("test requires two DHCP node toggles");
    fireEvent.click(secondaryToggle);
    expect(primaryToggle.checked).toBe(false);
    expect(secondaryToggle.checked).toBe(true);
    expect(screen.getByText("Planned handoff:")).not.toBeNull();
  });

  it("validates IPv4 fields inline and converts friendly duration before saving", async () => {
    const draft = makeDraft("eth0");
    mockLoad({ draft });
    const save = vi
      .spyOn(api, "updateConfigurationDraft")
      .mockImplementation(async (_clusterId, _version, document) => ({
        draft: { ...draft, document },
        issues: [],
      }));
    render(<DHCPPage cluster={cluster} />);
    fireEvent.change(await screen.findByLabelText("Range end"), {
      target: { value: "192.0.2.50" },
    });
    fireEvent.change(screen.getByLabelText("Range start"), {
      target: { value: "192.0.2.100" },
    });
    expect(
      screen.getByText("Range end must not be before range start."),
    ).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Lease duration"), {
      target: { value: "8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const saved = save.mock.calls[0]?.[2];
    expect(saved?.nodeOverrides[node.id]?.dhcp?.ipv4.leaseDurationSeconds).toBe(
      28_800,
    );
  });

  it("adds validated static leases and confirms draft-only removal", async () => {
    mockLoad({ draft: makeDraft("eth0") });
    render(<DHCPPage cluster={cluster} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Add static lease" }),
    );
    let dialog = screen.getByRole("dialog", { name: "Add static lease" });
    const add = within(dialog).getByRole("button", {
      name: "Add lease",
    }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("MAC address"), {
      target: { value: "aa:bb:cc:dd:ee:ff" },
    });
    fireEvent.change(within(dialog).getByLabelText("IP address"), {
      target: { value: "192.0.2.11" },
    });
    fireEvent.change(within(dialog).getByLabelText("Hostname"), {
      target: { value: "laptop" },
    });
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    expect(screen.getAllByText("laptop").length).toBeGreaterThan(1);
    const staticTable = screen.getByRole("table", {
      name: "Static leases for Primary",
    });
    const [removeButton] = within(staticTable).getAllByRole("button", {
      name: "Remove",
    });
    expect(removeButton).toBeDefined();
    if (!removeButton) return;
    fireEvent.click(removeButton);
    dialog = screen.getByRole("dialog", {
      name: "Remove static lease from draft?",
    });
    expect(within(dialog).getByText(/Nodes remain unchanged/)).not.toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove from draft" }),
    );
    expect(screen.queryByText("printer")).toBeNull();
  });

  it("edits an existing static lease in a focused draft-only dialog", async () => {
    mockLoad({ draft: makeDraft("eth0") });
    render(<DHCPPage cluster={cluster} />);
    const staticTable = await screen.findByRole("table", {
      name: "Static leases for Primary",
    });
    fireEvent.click(within(staticTable).getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog", { name: "Edit static lease" });
    fireEvent.change(within(dialog).getByLabelText("Hostname"), {
      target: { value: "printer-updated" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save lease" }));
    expect(within(staticTable).getByText("printer-updated")).not.toBeNull();
  });

  it("renders loading, empty-interface, and retryable inventory error states", async () => {
    mockLoad({ draft: makeDraft("eth0"), emptyInterfaces: true });
    const emptyView = render(<DHCPPage cluster={cluster} />);
    expect(screen.getByText("Loading DHCP settings…")).not.toBeNull();
    expect(await screen.findByText("No interfaces found")).not.toBeNull();
    emptyView.unmount();

    vi.restoreAllMocks();
    vi.spyOn(api, "configurationInventory").mockRejectedValue(
      new Error("Inventory failed"),
    );
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [],
      refreshedAt: "2026-08-02T00:00:00Z",
      staleAfterSeconds: 60,
    });
    render(<DHCPPage cluster={cluster} />);
    expect(await screen.findByText("Inventory failed")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull();
  });

  it.each([
    ["light", 1440],
    ["dark", 390],
  ])(
    "renders lease tables and keyboard dialog in %s theme at %dpx",
    async (theme, width) => {
      document.documentElement.dataset.theme = theme;
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: width,
      });
      mockLoad({ draft: makeDraft("eth0") });
      const { container } = render(<DHCPPage cluster={cluster} />);
      fireEvent.click(
        await screen.findByRole("button", { name: "Add static lease" }),
      );
      const dialog = screen.getByRole("dialog", { name: "Add static lease" });
      await waitFor(() =>
        expect(document.activeElement).toBe(
          within(dialog).getByRole("button", { name: "Close dialog" }),
        ),
      );
      expect(container.querySelectorAll(".data-table")).toHaveLength(2);
      expect(document.documentElement.dataset.theme).toBe(theme);
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(
        screen.queryByRole("dialog", { name: "Add static lease" }),
      ).toBeNull();
    },
  );
});
