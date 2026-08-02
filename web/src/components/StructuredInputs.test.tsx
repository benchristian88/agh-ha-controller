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
import {
  DomainListField,
  DurationField,
  IdentifierListEditor,
  NetworkListField,
  OrderedTextEditor,
  RuleEditor,
  UpstreamEditor,
  UrlListField,
  validateDomain,
  validateHttpUrl,
  validateIdentifier,
  validateNetwork,
} from "./StructuredInputs";

afterEach(cleanup);

describe("structured input validation", () => {
  it("validates duration preset and custom values", async () => {
    const changed = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <DurationField
        label="Lease duration"
        value={24}
        unit="hours"
        presets={[
          { label: "Daily", value: 24 },
          { label: "Weekly", value: 168 },
        ]}
        onChange={changed}
        max={720}
      />,
    );
    await user.selectOptions(screen.getByLabelText("Lease duration"), "168");
    expect(changed).toHaveBeenLastCalledWith(168);
    await user.selectOptions(screen.getByLabelText("Lease duration"), "custom");
    expect(screen.getByLabelText("Custom lease duration")).not.toBeNull();
    rerender(
      <DurationField
        label="Lease duration"
        value={25}
        unit="hours"
        presets={[{ label: "Daily", value: 24 }]}
        onChange={changed}
        max={720}
      />,
    );
    fireEvent.change(screen.getByLabelText("Custom lease duration"), {
      target: { value: "721" },
    });
    expect(changed).toHaveBeenLastCalledWith(721);
  });

  it("validates IPv4, IPv6, and CIDR inputs", () => {
    expect(validateNetwork("192.0.2.1")).toBeUndefined();
    expect(validateNetwork("2001:db8::1")).toBeUndefined();
    expect(validateNetwork("192.0.2.0/24")).toBeUndefined();
    expect(validateNetwork("192.0.2.0/44")).toContain("0 to 32");
    expect(validateNetwork("999.0.0.1")).toContain("valid");
  });

  it("validates domains, URLs, and client identifiers", () => {
    expect(validateDomain("example.org")).toBeUndefined();
    expect(validateDomain("*.example.org", true)).toBeUndefined();
    expect(validateDomain("bad domain")).toContain("valid");
    expect(validateHttpUrl("https://example.org/list.txt")).toBeUndefined();
    expect(validateHttpUrl("ftp://example.org/list.txt")).toContain("HTTP");
    expect(validateHttpUrl("https://user:pass@example.org/list.txt")).toContain(
      "credentials",
    );
    expect(validateIdentifier("00:11:22:33:44:55")).toBeUndefined();
    expect(validateIdentifier("client-laptop")).toBeUndefined();
    expect(validateIdentifier("192.0.2.999")).toContain("valid");
    expect(validateIdentifier("bad identifier spaces")).toContain("valid");
  });
});

describe("structured list editors", () => {
  it("adds a valid network with the keyboard and never calls a save action", async () => {
    const changed = vi.fn();
    const save = vi.fn();
    const user = userEvent.setup();
    render(
      <form onSubmit={save}>
        <NetworkListField label="Networks" value={[]} onChange={changed} />
      </form>,
    );
    const input = screen.getByLabelText("New Networks entry");
    await user.type(input, "192.0.2.0/24{Enter}");
    expect(changed).toHaveBeenCalledWith(["192.0.2.0/24"]);
    expect(save).not.toHaveBeenCalled();
  });

  it("shows invalid rows for every typed list and supports removal", () => {
    const domainChange = vi.fn();
    const urlChange = vi.fn();
    const identifierChange = vi.fn();
    render(
      <>
        <DomainListField
          label="Domains"
          value={["bad domain"]}
          onChange={domainChange}
        />
        <UrlListField
          label="URLs"
          value={["file:///tmp/list"]}
          onChange={urlChange}
        />
        <IdentifierListEditor
          label="Identifiers"
          value={["not valid id"]}
          onChange={identifierChange}
        />
      </>,
    );
    expect(screen.getAllByText(/valid|HTTP/).length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByRole("button", { name: "Remove bad domain" }));
    expect(domainChange).toHaveBeenCalledWith([]);
  });

  it("renders stale and unsupported list states", () => {
    const { container } = render(
      <NetworkListField
        label="Networks"
        value={[]}
        onChange={() => undefined}
        stale
        unsupported
      />,
    );
    expect(screen.getByText(/capability data before relying/)).not.toBeNull();
    expect(
      screen.getByText(/unavailable for the selected scope/),
    ).not.toBeNull();
    expect(container.querySelector("fieldset")?.hasAttribute("disabled")).toBe(
      true,
    );
  });
});

describe("ordered specialist editors", () => {
  it("preserves order in OrderedTextEditor", () => {
    const changed = vi.fn();
    render(
      <OrderedTextEditor
        label="Ordered values"
        value={["one", "two"]}
        onChange={changed}
      />,
    );
    fireEvent.change(screen.getByLabelText("Ordered values"), {
      target: { value: "two\none" },
    });
    expect(changed).toHaveBeenCalledWith(["two", "one"]);
  });

  it("wraps filtering rules and upstream syntax with specialist guidance", () => {
    render(
      <>
        <RuleEditor
          label="Rules"
          value={["||example.org^"]}
          onChange={() => undefined}
        />
        <UpstreamEditor
          label="Upstreams"
          value={["bad upstream"]}
          onChange={() => undefined}
        />
      </>,
    );
    expect(screen.getByText(/filtering rule per line/)).not.toBeNull();
    const upstream = within(
      screen.getByLabelText("Upstreams").closest(".field") as HTMLElement,
    );
    expect(upstream.getByRole("alert").textContent).toContain("whitespace");
  });
});
