// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageContainer, PageHeader } from "./Page";
import {
  CapabilityWarning,
  Field,
  ScopeIndicator,
  SettingRow,
  SettingsGroup,
  UnsavedChangesNotice,
} from "./Settings";

afterEach(cleanup);

describe("page primitives", () => {
  it("renders every documented width and page-header slot", () => {
    const { container } = render(
      <PageContainer size="full">
        <PageHeader
          eyebrow="System"
          title="Example"
          description="Description"
          primaryAction={<button type="button">Save</button>}
          secondaryActions={<button type="button">Cancel</button>}
          statusNotice={<span>Stale</span>}
        />
      </PageContainer>,
    );
    expect(container.querySelector(".page-container--full")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Example" })).not.toBeNull();
    expect(screen.getByText("Description")).not.toBeNull();
    expect(screen.getByText("Stale")).not.toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("can move route focus to the page title", () => {
    render(<PageHeader title="Focused page" focusOnMount />);
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Focused page" }),
    );
  });
});

describe("settings primitives", () => {
  it("composes a group, setting row, field, scope, and status", () => {
    const { container } = render(
      <SettingsGroup title="DNS" description="Resolver policy">
        <SettingRow
          title="Protection"
          description="Enable filtering"
          control={<input aria-label="Protection" type="checkbox" />}
          status={<ScopeIndicator scope="cluster" />}
        />
        <Field
          label="Server"
          htmlFor="server"
          help="A resolver address"
          error="Required"
          suffix="IP"
          scope={<ScopeIndicator scope="node" />}
        >
          <input id="server" />
        </Field>
      </SettingsGroup>,
    );
    expect(screen.getByRole("heading", { name: "DNS" })).not.toBeNull();
    expect(screen.getByLabelText("Server")).not.toBeNull();
    expect(screen.getByText("Entire Cluster")).not.toBeNull();
    expect(screen.getByText("Node specific")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Required");
    expect(
      container.querySelector(".settings-group__body--rows"),
    ).not.toBeNull();
  });

  it("provides an explicit padded panel-body variant", () => {
    const { container } = render(
      <SettingsGroup title="Operational panel" bodySpacing="padded">
        <p>Inset content</p>
      </SettingsGroup>,
    );
    expect(
      container.querySelector(".settings-group__body--padded"),
    ).not.toBeNull();
  });

  it("renders unsupported and unsaved states without saving implicitly", () => {
    const save = vi.fn();
    render(
      <>
        <CapabilityWarning state="unsupported">
          Requires a newer node.
        </CapabilityWarning>
        <UnsavedChangesNotice dirty onSave={save} />
      </>,
    );
    expect(screen.getByText("Requires a newer node.")).not.toBeNull();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(save).toHaveBeenCalledOnce();
  });
});
