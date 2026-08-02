import { describe, expect, it } from "vitest";
import { CANONICAL_PATHS, LEGACY_REDIRECTS, resolveRoute } from "./routes";

describe("canonical route safety", () => {
  it("resolves every canonical route without a redirect or fallback", () => {
    for (const path of CANONICAL_PATHS) {
      expect(["redirect", "not-found"]).not.toContain(resolveRoute(path).kind);
    }
  });

  it("keeps the complete canonical route table stable", () => {
    const expectedKinds = {
      "/": "dashboard",
      "/statistics": "planned",
      "/settings/general": "settings",
      "/settings/dns": "settings",
      "/settings/encryption": "settings",
      "/settings/clients": "settings",
      "/settings/dhcp": "settings",
      "/filters/blocklists": "blocklists",
      "/filters/allowlists": "allowlists",
      "/filters/rewrites": "settings",
      "/filters/blocked-services": "blocked-services",
      "/filters/custom-rules": "settings",
      "/query-log": "planned",
      "/ha/nodes": "nodes",
      "/ha/configuration": "configuration",
      "/ha/deployments": "control-plane",
      "/ha/drift": "control-plane",
      "/ha/history": "history",
      "/setup-guide": "planned",
      "/system/users": "planned",
      "/system/audit": "audit",
      "/system/settings": "planned",
      "/system/backups": "planned",
      "/system/about": "planned",
    } as const;

    expect(Object.keys(expectedKinds)).toEqual([...CANONICAL_PATHS]);
    for (const [path, kind] of Object.entries(expectedKinds))
      expect(resolveRoute(path).kind).toBe(kind);
    expect(resolveRoute("/ha/deployments")).toMatchObject({
      focus: "deployments",
    });
    expect(resolveRoute("/ha/drift")).toMatchObject({ focus: "drift" });
  });

  it("renders an explicit not-found result for unknown paths", () => {
    expect(resolveRoute("/mistyped-dashboard")).toEqual({ kind: "not-found" });
    expect(resolveRoute("/settings/not-real")).toEqual({ kind: "not-found" });
  });
});

describe("route migration", () => {
  it("resolves General Settings canonically and redirects its broad legacy route", () => {
    expect(resolveRoute("/settings/general")).toMatchObject({
      kind: "settings",
      area: "privacy",
    });
    expect(resolveRoute("/settings/privacy")).toEqual({
      kind: "redirect",
      to: "/settings/general",
    });
  });

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

  it("resolves DNS Allowlists to its dedicated feature page", () => {
    expect(resolveRoute("/filters/allowlists")).toEqual({
      kind: "allowlists",
    });
  });
});
