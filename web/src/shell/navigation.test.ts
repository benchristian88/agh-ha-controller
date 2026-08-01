import { describe, expect, it } from "vitest";
import { resolveRoute } from "../routing/routes";
import {
  ADMINISTRATION_NAVIGATION,
  isGroupActive,
  isNavigationGroup,
  PRIMARY_NAVIGATION,
} from "./navigation";

describe("application navigation", () => {
  it("uses only canonical, explicitly handled routes", () => {
    const primaryLinks = PRIMARY_NAVIGATION.flatMap((item) =>
      isNavigationGroup(item) ? item.children : [item],
    );
    for (const item of [...primaryLinks, ...ADMINISTRATION_NAVIGATION]) {
      expect(["redirect", "not-found"]).not.toContain(
        resolveRoute(item.href).kind,
      );
    }
  });

  it("highlights a parent when any active child is selected", () => {
    const filters = PRIMARY_NAVIGATION.find((item) => item.label === "Filters");
    expect(filters && isNavigationGroup(filters)).toBe(true);
    if (!filters || !isNavigationGroup(filters)) return;

    expect(isGroupActive(filters, "/filters/rewrites")).toBe(true);
    expect(isGroupActive(filters, "/settings/dns")).toBe(false);
  });
});
