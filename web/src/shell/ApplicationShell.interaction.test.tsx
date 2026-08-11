// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type {
  Cluster,
  ConfigurationRevision,
  Deployment,
  Node,
} from "../lib/types";
import { ThemeProvider } from "../theme/ThemeProvider";
import { installMatchMedia } from "../theme/testMatchMedia";
import { ApplicationShell } from "./ApplicationShell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
});

beforeEach(() => installMatchMedia());

function ShellTest({ children = <p>Page</p> }: { children?: ReactNode }) {
  return (
    <ThemeProvider>
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
        {children}
      </ApplicationShell>
    </ThemeProvider>
  );
}

describe("shell menu keyboard behavior", () => {
  it("opens a desktop menu and the mobile drawer from the keyboard", async () => {
    const user = userEvent.setup();
    render(<ShellTest />);

    const settingsButton = screen.getByRole("button", { name: /Settings/ });
    await user.click(settingsButton);
    expect(settingsButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu", { name: /Settings/ })).toBeTruthy();

    const drawerButton = screen.getByRole("button", {
      name: "Open navigation",
    });
    drawerButton.focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeNull();
    const mobileNavigation = screen.getByRole("navigation", {
      name: "Mobile navigation",
    });
    const mobileSettings = mobileNavigation.querySelector(
      '.mobile-nav-group[data-open="true"]',
    );
    expect(mobileSettings?.textContent).toContain("DNS");
    await user.click(
      within(mobileNavigation).getByRole("button", { name: "Filters" }),
    );
    expect(
      within(mobileNavigation)
        .getByRole("button", { name: "Settings" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      within(mobileNavigation)
        .getByRole("button", { name: "Filters" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(drawerButton));
  });

  it("coordinates hover, peer switching, delayed leave, and touch clicks", async () => {
    vi.useFakeTimers();
    render(<ShellTest />);
    const settings = screen.getByRole("button", { name: /Settings/ });
    const filters = screen.getByRole("button", { name: /Filters/ });

    fireEvent.mouseEnter(settings.parentElement as HTMLElement);
    expect(settings.getAttribute("aria-expanded")).toBe("true");

    fireEvent.mouseEnter(filters.parentElement as HTMLElement);
    expect(filters.getAttribute("aria-expanded")).toBe("true");
    expect(settings.getAttribute("aria-expanded")).toBe("false");

    const filtersRoot = filters.parentElement as HTMLElement;
    fireEvent.mouseLeave(filtersRoot);
    act(() => vi.advanceTimersByTime(179));
    expect(filters.getAttribute("aria-expanded")).toBe("true");
    fireEvent.mouseEnter(screen.getByRole("menu"));
    act(() => vi.advanceTimersByTime(1));
    expect(filters.getAttribute("aria-expanded")).toBe("true");
    fireEvent.mouseLeave(filtersRoot);
    act(() => vi.advanceTimersByTime(180));
    expect(filters.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(settings);
    expect(settings.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(settings);
    expect(settings.getAttribute("aria-expanded")).toBe("false");
    fireEvent.pointerEnter(settings.parentElement as HTMLElement, {
      pointerType: "touch",
    });
    expect(settings.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(settings);
    expect(settings.getAttribute("aria-expanded")).toBe("true");
    vi.useRealTimers();
  });

  it("closes outside, restores trigger focus on Escape, and moves menu focus", async () => {
    const user = userEvent.setup();
    render(<ShellTest />);
    const settings = screen.getByRole("button", { name: /Settings/ });

    settings.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe("General"),
    );
    await user.keyboard("{Escape}");
    expect(settings.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(settings);

    await user.click(settings);
    fireEvent.pointerDown(screen.getByLabelText("Controller context"));
    expect(settings.getAttribute("aria-expanded")).toBe("false");
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
      <ThemeProvider>
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
        </ApplicationShell>
      </ThemeProvider>,
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
