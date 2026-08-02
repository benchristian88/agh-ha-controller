// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlockedServicesCatalogue } from "../../lib/types";
import { ServiceCatalogue } from "./ServiceCatalogue";

afterEach(cleanup);

const catalogue: BlockedServicesCatalogue = {
  generatedAt: "2026-08-01T00:00:00Z",
  stale: false,
  partial: false,
  groups: [{ id: "ai" }, { id: "streaming" }],
  nodes: [
    {
      nodeId: "node-a",
      nodeName: "Primary",
      status: "available",
      serviceCount: 3,
    },
    {
      nodeId: "node-b",
      nodeName: "Secondary",
      status: "available",
      serviceCount: 2,
    },
  ],
  services: [
    {
      id: "chatgpt",
      name: "ChatGPT",
      groupId: "ai",
      supportedNodeIds: ["node-a"],
      unsupportedNodeIds: ["node-b"],
    },
    {
      id: "youtube",
      name: "YouTube",
      groupId: "streaming",
      supportedNodeIds: ["node-a", "node-b"],
      unsupportedNodeIds: [],
    },
    {
      id: "netflix",
      name: "Netflix",
      groupId: "streaming",
      supportedNodeIds: ["node-a", "node-b"],
      unsupportedNodeIds: [],
    },
  ],
};

describe("service catalogue", () => {
  it("searches, filters by group, and renders a purposeful empty result", () => {
    render(
      <ServiceCatalogue
        catalogue={catalogue}
        selectedIDs={[]}
        onChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Search services"), {
      target: { value: "chat" },
    });
    expect(screen.getByText("ChatGPT")).not.toBeNull();
    expect(screen.queryByText("Netflix")).toBeNull();
    fireEvent.change(screen.getByLabelText("Search services"), {
      target: { value: "missing" },
    });
    expect(screen.getByText("No services match this search")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Search services"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: "streaming" },
    });
    expect(screen.getByText("Netflix")).not.toBeNull();
    expect(screen.queryByText("ChatGPT")).toBeNull();
  });

  it("toggles services, selects and clears a group, and counts legacy IDs", () => {
    const change = vi.fn();
    const { rerender } = render(
      <ServiceCatalogue
        catalogue={catalogue}
        selectedIDs={["youtube", "legacy-service"]}
        onChange={change}
      />,
    );
    expect(screen.getByText("Unknown or unsupported IDs")).not.toBeNull();
    expect(screen.getByText("legacy-service")).not.toBeNull();
    expect(screen.getByText("2")).not.toBeNull();

    fireEvent.click(screen.getByLabelText("Block ChatGPT"));
    expect(change).toHaveBeenLastCalledWith([
      "chatgpt",
      "legacy-service",
      "youtube",
    ]);

    const streaming = screen.getByRole("heading", { name: "Streaming" })
      .parentElement?.parentElement;
    if (streaming === null || streaming === undefined)
      throw new Error("group missing");
    fireEvent.click(
      within(streaming).getByRole("button", { name: "Select all" }),
    );
    expect(change).toHaveBeenLastCalledWith([
      "legacy-service",
      "netflix",
      "youtube",
    ]);

    rerender(
      <ServiceCatalogue
        catalogue={catalogue}
        selectedIDs={["netflix", "youtube"]}
        onChange={change}
      />,
    );
    const updatedStreaming = screen.getByRole("heading", { name: "Streaming" })
      .parentElement?.parentElement;
    if (updatedStreaming === null || updatedStreaming === undefined)
      throw new Error("group missing");
    fireEvent.click(
      within(updatedStreaming).getByRole("button", { name: "Clear group" }),
    );
    expect(change).toHaveBeenLastCalledWith([]);
  });

  it("shows node-attributed unsupported state", () => {
    render(
      <ServiceCatalogue
        catalogue={catalogue}
        selectedIDs={["chatgpt"]}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getAllByText("Unsupported by Secondary").length,
    ).toBeGreaterThan(0);
  });

  it("uses keyboard-reachable native search, group, and service controls", async () => {
    const user = userEvent.setup();
    render(
      <ServiceCatalogue
        catalogue={catalogue}
        selectedIDs={[]}
        onChange={vi.fn()}
      />,
    );
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByLabelText("Search services"),
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Group"));
    await user.tab();
    expect((document.activeElement as HTMLElement).tagName).toBe("BUTTON");
    await user.tab();
    expect((document.activeElement as HTMLElement).tagName).toBe("INPUT");
  });
});
