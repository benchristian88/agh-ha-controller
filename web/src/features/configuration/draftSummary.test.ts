import { describe, expect, it } from "vitest";
import type { DesiredConfigurationDocument } from "../../lib/types";
import { buildDraftSummary } from "./draftSummary";

const document: DesiredConfigurationDocument = {
  schemaVersion: 2,
  shared: {
    dns: {
      upstreamDns: ["1.1.1.1"],
      bootstrapDns: [],
      fallbackDns: [],
      privateReverseDns: [],
      protectionEnabled: true,
      rateLimit: 20,
      rateLimitSubnetLengthIpv4: 24,
      rateLimitSubnetLengthIpv6: 56,
      rateLimitAllowlist: [],
      blockingMode: "default",
      blockingIpv4: "",
      blockingIpv6: "",
      blockedResponseTtl: 10,
      ednsClientSubnet: false,
      ednsUseCustom: false,
      ednsCustomIp: "",
      disableIpv6: false,
      dnssecEnabled: true,
      cacheSize: 4194304,
      cacheEnabled: true,
      cacheTtlMin: 0,
      cacheTtlMax: 0,
      cacheOptimistic: false,
      upstreamMode: "load_balance",
      usePrivateReverseResolvers: true,
      resolveClients: true,
      upstreamTimeoutSeconds: 10,
    },
    filtering: {
      enabled: true,
      updateIntervalHours: 24,
      filterUrls: ["https://example.test/block.txt"],
      whitelistUrls: [],
      userRules: ["||example.test^"],
    },
    clients: [],
    rewritesEnabled: true,
    rewrites: [],
    services: {
      blockedServiceIds: [],
      blockedSchedule: { timeZone: "Local", days: {} },
      safeBrowsing: true,
      parentalControl: false,
      safeSearch: {
        enabled: true,
        bing: true,
        duckDuckGo: false,
        ecosia: false,
        google: true,
        pixabay: false,
        yandex: false,
        youTube: true,
      },
    },
    queryLog: {
      enabled: true,
      intervalMillis: 86400000,
      anonymizeClientIp: false,
      ignored: [],
      ignoredEnabled: false,
    },
    statistics: {
      enabled: true,
      intervalMillis: 86400000,
      ignored: [],
      ignoredEnabled: false,
    },
  },
  nodeOverrides: {
    "node-a": { bindHosts: ["0.0.0.0"], dnsPort: 53 },
  },
  unsupported: [],
};

describe("schema-v2 draft summary", () => {
  it("rejects obsolete draft schemas without dereferencing v2-only fields", () => {
    const legacy = {
      schemaVersion: 1,
      shared: {
        dns: { upstreamDns: [] },
        filtering: { enabled: true, filterUrls: [], userRules: [] },
      },
      nodeOverrides: {},
      unsupported: [],
    } as unknown as DesiredConfigurationDocument;

    expect(buildDraftSummary(legacy)).toEqual([]);
  });

  it("treats nullable empty collections from JSON as empty", () => {
    const nullable = structuredClone(document) as DesiredConfigurationDocument;
    nullable.shared.clients = null as unknown as typeof nullable.shared.clients;
    nullable.shared.rewrites =
      null as unknown as typeof nullable.shared.rewrites;
    nullable.shared.filtering.whitelistUrls = null as unknown as string[];
    nullable.unsupported = null as unknown as typeof nullable.unsupported;

    const sections = buildDraftSummary(nullable);

    expect(
      sections.find((section) => section.id === "clients")?.items[0]?.value,
    ).toBe("0 clients");
    expect(
      sections.find((section) => section.id === "unsupported")?.items[0]?.value,
    ).toBe("0 entries");
  });

  it("covers every authoring domain without exposing an editor", () => {
    const sections = buildDraftSummary(
      document,
      undefined,
      new Map([["node-a", "Primary DNS"]]),
    );

    expect(sections.map((section) => section.id)).toEqual([
      "general",
      "dns",
      "blocklists",
      "allowlists",
      "custom-rules",
      "clients",
      "rewrites",
      "services",
      "dhcp",
      "unsupported",
    ]);
    expect(sections.every((section) => section.change === "unpublished")).toBe(
      true,
    );
    expect(sections.find((section) => section.id === "dhcp")?.items[0]).toEqual(
      {
        label: "Primary DNS listener",
        value: "1 bind address · port 53",
      },
    );
  });

  it("marks only changed domains against the active revision", () => {
    const active = structuredClone(document);
    active.shared.dns.dnssecEnabled = false;

    const changes = new Map(
      buildDraftSummary(document, active).map((section) => [
        section.id,
        section.change,
      ]),
    );
    expect(changes.get("dns")).toBe("changed");
    expect(changes.get("clients")).toBe("unchanged");
  });
});
