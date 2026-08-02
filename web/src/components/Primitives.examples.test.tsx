// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SharedPrimitivesShowcase } from "./Primitives.examples";

afterEach(cleanup);

it("provides light, dark, desktop, mobile, and state visual examples", () => {
  const { container } = render(<SharedPrimitivesShowcase />);
  expect(container.querySelector('[data-theme="light"]')).not.toBeNull();
  expect(container.querySelector('[data-theme="dark"]')).not.toBeNull();
  expect(container.querySelector('[data-viewport="desktop"]')).not.toBeNull();
  expect(container.querySelector('[data-viewport="mobile"]')).not.toBeNull();
  expect(container.querySelector(".partial-success-panel")).not.toBeNull();
  expect(container.querySelector(".loading-skeleton")).not.toBeNull();
  expect(container.querySelector('[data-stale="true"]')).not.toBeNull();
});
