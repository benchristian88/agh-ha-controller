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
import { ConfirmDialog, Dialog, OperationalCommandDialog } from "./Overlays";

afterEach(cleanup);

describe("dialogs", () => {
  it("traps keyboard focus, closes with Escape, and returns focus", async () => {
    const close = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { rerender } = render(
      <Dialog
        open
        onClose={close}
        title="Example dialog"
        actions={<button type="button">Last action</button>}
      >
        <button type="button">First action</button>
      </Dialog>,
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Close dialog" }),
      ),
    );
    const last = screen.getByRole("button", { name: "Last action" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close dialog" }),
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
    rerender(
      <Dialog open={false} onClose={close} title="Example dialog">
        content
      </Dialog>,
    );
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("requires exact typed confirmation and supports keyboard entry", async () => {
    const confirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        onClose={() => undefined}
        onConfirm={confirm}
        title="Remove node"
        confirmLabel="Remove"
        confirmationText="primary"
      />,
    );
    const button = screen.getByRole("button", { name: "Remove" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await user.type(screen.getByRole("textbox"), "primary");
    expect(button.hasAttribute("disabled")).toBe(false);
    await user.click(button);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("shows explicit scope and lifecycle for operational commands", () => {
    render(
      <OperationalCommandDialog
        open
        onClose={() => undefined}
        onConfirm={() => undefined}
        command="Refresh filters"
        scope="Entire Cluster"
        impact="Contacts every enabled node"
      />,
    );
    expect(screen.getByText("Entire Cluster")).not.toBeNull();
    expect(
      screen.getByText(/do not modify the configuration draft/),
    ).not.toBeNull();
  });
});
