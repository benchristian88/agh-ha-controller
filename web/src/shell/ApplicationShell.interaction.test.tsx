// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ApplicationShell } from "./ApplicationShell";

afterEach(cleanup);

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
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).toBeNull();
  });
});
