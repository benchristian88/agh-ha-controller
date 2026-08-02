// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type {
  Cluster,
  ConfigurationRevision,
  Deployment,
  Node,
} from "../lib/types";
import { ApplicationShell } from "./ApplicationShell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("shell menu keyboard behavior", () => {
  it("opens a desktop menu and the mobile drawer from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationShell
        user={{
          id: "user-1",
          email: "operator@example.test",
          displayName: "Operator",
          role: "administrator",
        }}
        clusters={[]}
        pathname="/settings/dns"
        onSelectCluster={() => undefined}
        onLogout={() => undefined}
      >
        <p>Page</p>
      </ApplicationShell>,
    );

    const settingsSummary = screen.getByText("Settings");
    expect(settingsSummary.tagName).toBe("SUMMARY");
    await user.click(settingsSummary);
    expect(settingsSummary.closest("details")?.hasAttribute("open")).toBe(true);

    const drawerButton = screen.getByRole("button", {
      name: "Open navigation",
    });
    drawerButton.focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeNull();
    const mobileSettings = screen
      .getByRole("navigation", { name: "Mobile navigation" })
      .querySelector(".mobile-nav-group[open]");
    expect(mobileSettings?.textContent).toContain("DNS");
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).toBeNull();
  });

  it("shows cluster, scope, revision, health, and active-deployment context", async () => {
    const cluster = {
      id: "cluster-1",
      name: "Home DNS",
      activeRevisionId: "revision-1",
    } as Cluster;
    const node = {
      id: "node-1",
      clusterId: cluster.id,
      name: "Primary",
      enabled: true,
      healthStatus: "healthy",
    } as Node;
    const revision = {
      id: "revision-1",
      revisionNumber: 24,
      active: true,
    } as ConfigurationRevision;
    const deployment = {
      id: "deployment-12345678",
      status: "running",
      nodes: [{ id: "task-1", nodeId: node.id, status: "applying" }],
    } as Deployment;
    vi.spyOn(api, "nodes").mockResolvedValue({
      items: [node],
      refreshedAt: "2026-08-02T00:00:00Z",
      staleAfterSeconds: 60,
    });
    vi.spyOn(api, "configurationRevisions").mockResolvedValue({
      items: [revision],
    });
    vi.spyOn(api, "deployments").mockResolvedValue({ items: [deployment] });
    vi.spyOn(api, "deployment").mockResolvedValue(deployment);

    render(
      <ApplicationShell
        user={{
          id: "user-1",
          email: "operator@example.test",
          displayName: "Operator",
          role: "administrator",
        }}
        clusters={[cluster]}
        selected={cluster}
        pathname="/ha/drift"
        onSelectCluster={() => undefined}
        onLogout={() => undefined}
      >
        <p>Page</p>
      </ApplicationShell>,
    );

    await waitFor(() => expect(screen.getByText("#24")).toBeTruthy());
    expect(screen.getByRole("option", { name: "Home DNS" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Entire Cluster" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Primary" })).toBeTruthy();
    expect(screen.getByText("Healthy")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /deployme · applying Primary/ }),
    ).toBeTruthy();
  });
});
