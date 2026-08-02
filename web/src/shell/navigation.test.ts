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
    const cases = [
      ["Settings", "/settings/dns"],
      ["Filters", "/filters/rewrites"],
      ["HA Controller", "/ha/drift"],
    ] as const;
    for (const [label, pathname] of cases) {
      const group = PRIMARY_NAVIGATION.find((item) => item.label === label);
      expect(group && isNavigationGroup(group)).toBe(true);
      if (!group || !isNavigationGroup(group)) continue;
      expect(isGroupActive(group, pathname)).toBe(true);
      expect(isGroupActive(group, "/")).toBe(false);
    }
  });
});
