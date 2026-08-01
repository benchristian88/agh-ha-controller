import { describe, expect, it } from "vitest";
import { CANONICAL_PATHS, LEGACY_REDIRECTS, resolveRoute } from "./routes";

describe("canonical route safety", () => {
  it("resolves every canonical route without a redirect or fallback", () => {
    for (const path of CANONICAL_PATHS) {
      expect(["redirect", "not-found"]).not.toContain(resolveRoute(path).kind);
    }
  });

  it("renders an explicit not-found result for unknown paths", () => {
    expect(resolveRoute("/mistyped-dashboard")).toEqual({ kind: "not-found" });
    expect(resolveRoute("/settings/not-real")).toEqual({ kind: "not-found" });
  });
});

describe("route migration", () => {
  it("redirects every legacy bookmark to its approved canonical route", () => {
    for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
      expect(resolveRoute(from)).toEqual({ kind: "redirect", to });
      expect(resolveRoute(to).kind).not.toBe("not-found");
    }
  });

  it("normalises trailing slashes without changing route identity", () => {
    expect(resolveRoute("/ha/configuration/")).toEqual({
      kind: "redirect",
      to: "/ha/configuration",
    });
  });

  it("resolves Blocked Services to its dedicated feature page", () => {
    expect(resolveRoute("/filters/blocked-services")).toEqual({
      kind: "blocked-services",
    });
    expect(resolveRoute("/settings/services")).toEqual({
      kind: "redirect",
      to: "/filters/blocked-services",
    });
  });

  it("resolves DNS Blocklists to its dedicated feature page", () => {
    expect(resolveRoute("/filters/blocklists")).toEqual({
      kind: "blocklists",
    });
  });
});
