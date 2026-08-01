import type { DesiredConfigurationDocument } from "../../lib/types";

export interface DraftSummaryItem {
  label: string;
  value: string;
}

export interface DraftSummarySection {
  id: string;
  title: string;
  href: string;
  description: string;
  change: "changed" | "unchanged" | "unpublished";
  items: DraftSummaryItem[];
}

const yesNo = (value: boolean) => (value ? "Enabled" : "Disabled");
const count = (
  value: readonly unknown[] | null | undefined,
  noun: string,
  plural = `${noun}s`,
) => {
  const length = value?.length ?? 0;
  return `${length} ${length === 1 ? noun : plural}`;
};
const seconds = (value: number) => `${value} seconds`;
const millis = (value: number) => `${value} ms`;

function changeState(
  current: unknown,
  active: unknown | undefined,
): DraftSummarySection["change"] {
  if (active === undefined) return "unpublished";
  return JSON.stringify(current) === JSON.stringify(active)
    ? "unchanged"
    : "changed";
}

export function buildDraftSummary(
  document: DesiredConfigurationDocument,
  active?: DesiredConfigurationDocument,
  nodeNames: ReadonlyMap<string, string> = new Map(),
): DraftSummarySection[] {
  if (document.schemaVersion !== 2) return [];

  const { dns, filtering, services, queryLog, statistics } = document.shared;
  const clients = document.shared.clients ?? [];
  const rewrites = document.shared.rewrites ?? [];
  const safeSearchProviders = Object.entries(services.safeSearch ?? {})
    .filter(([key, enabled]) => key !== "enabled" && enabled)
    .map(([key]) => key);
  const scheduledDays = Object.values(
    services.blockedSchedule.days ?? {},
  ).filter((day) => day.end > day.start).length;

  const nodeItems = Object.entries(document.nodeOverrides ?? {}).flatMap(
    ([nodeID, override]): DraftSummaryItem[] => {
      const name = nodeNames.get(nodeID) ?? nodeID;
      const items: DraftSummaryItem[] = [
        {
          label: `${name} listener`,
          value: `${count(override.bindHosts, "bind address")} · port ${override.dnsPort}`,
        },
      ];
      if (override.dhcp !== undefined) {
        items.push({
          label: `${name} DHCP`,
          value: `${yesNo(override.dhcp.enabled)} · ${override.dhcp.interfaceName || "no interface"} · ${count(override.dhcp.staticLeases, "static lease")}`,
        });
      } else {
        items.push({ label: `${name} DHCP`, value: "Not configured" });
      }
      return items;
    },
  );

  return [
    {
      id: "general",
      title: "General",
      href: "/settings/general",
      description: "Collection policies retained on each AdGuard Home node.",
      change: changeState(
        { queryLog, statistics },
        active && {
          queryLog: active.shared.queryLog,
          statistics: active.shared.statistics,
        },
      ),
      items: [
        { label: "Query log", value: yesNo(queryLog.enabled) },
        { label: "Query-log interval", value: millis(queryLog.intervalMillis) },
        {
          label: "Anonymise client IP",
          value: yesNo(queryLog.anonymizeClientIp),
        },
        {
          label: "Query-log ignored hosts",
          value: `${yesNo(queryLog.ignoredEnabled)} · ${count(queryLog.ignored, "host")}`,
        },
        { label: "Statistics", value: yesNo(statistics.enabled) },
        {
          label: "Statistics interval",
          value: millis(statistics.intervalMillis),
        },
        {
          label: "Statistics ignored hosts",
          value: `${yesNo(statistics.ignoredEnabled)} · ${count(statistics.ignored, "host")}`,
        },
      ],
    },
    {
      id: "dns",
      title: "DNS",
      href: "/settings/dns",
      description:
        "Resolver, blocking, rate limiting, DNSSEC, and cache policy.",
      change: changeState(dns, active?.shared.dns),
      items: [
        { label: "Protection", value: yesNo(dns.protectionEnabled) },
        { label: "Upstreams", value: count(dns.upstreamDns, "resolver") },
        { label: "Bootstrap DNS", value: count(dns.bootstrapDns, "resolver") },
        { label: "Fallback DNS", value: count(dns.fallbackDns, "resolver") },
        {
          label: "Private reverse DNS",
          value: `${yesNo(dns.usePrivateReverseResolvers)} · ${count(dns.privateReverseDns, "resolver")}`,
        },
        { label: "Resolve client names", value: yesNo(dns.resolveClients) },
        { label: "Upstream mode", value: dns.upstreamMode || "Default" },
        {
          label: "Upstream timeout",
          value: seconds(dns.upstreamTimeoutSeconds),
        },
        { label: "Rate limit", value: `${dns.rateLimit} requests/second` },
        {
          label: "Rate-limit subnets",
          value: `IPv4 /${dns.rateLimitSubnetLengthIpv4} · IPv6 /${dns.rateLimitSubnetLengthIpv6}`,
        },
        {
          label: "Rate-limit allowlist",
          value: count(dns.rateLimitAllowlist, "network"),
        },
        { label: "Blocking mode", value: dns.blockingMode || "Default" },
        {
          label: "Custom blocking addresses",
          value:
            dns.blockingIpv4 || dns.blockingIpv6
              ? [dns.blockingIpv4, dns.blockingIpv6].filter(Boolean).join(" · ")
              : "Not set",
        },
        {
          label: "Blocked response TTL",
          value: seconds(dns.blockedResponseTtl),
        },
        {
          label: "EDNS Client Subnet",
          value: `${yesNo(dns.ednsClientSubnet)}${dns.ednsUseCustom ? ` · custom ${dns.ednsCustomIp || "not set"}` : ""}`,
        },
        { label: "DNSSEC", value: yesNo(dns.dnssecEnabled) },
        { label: "Disable IPv6 answers", value: yesNo(dns.disableIpv6) },
        {
          label: "Cache",
          value: `${yesNo(dns.cacheEnabled)} · ${dns.cacheSize} bytes`,
        },
        {
          label: "Cache TTL overrides",
          value: `${seconds(dns.cacheTtlMin)} minimum · ${seconds(dns.cacheTtlMax)} maximum`,
        },
        { label: "Optimistic cache", value: yesNo(dns.cacheOptimistic) },
      ],
    },
    {
      id: "blocklists",
      title: "DNS blocklists",
      href: "/filters/blocklists",
      description:
        "Filtering state, refresh interval, and blocklist subscriptions.",
      change: changeState(
        {
          enabled: filtering.enabled,
          updateIntervalHours: filtering.updateIntervalHours,
          filterUrls: filtering.filterUrls,
        },
        active && {
          enabled: active.shared.filtering.enabled,
          updateIntervalHours: active.shared.filtering.updateIntervalHours,
          filterUrls: active.shared.filtering.filterUrls,
        },
      ),
      items: [
        { label: "Filtering", value: yesNo(filtering.enabled) },
        {
          label: "Update interval",
          value: `${filtering.updateIntervalHours} hours`,
        },
        { label: "Subscriptions", value: count(filtering.filterUrls, "list") },
      ],
    },
    {
      id: "allowlists",
      title: "DNS allowlists",
      href: "/filters/allowlists",
      description: "Allowlist subscriptions shared by every managed node.",
      change: changeState(
        filtering.whitelistUrls,
        active?.shared.filtering.whitelistUrls,
      ),
      items: [
        {
          label: "Subscriptions",
          value: count(filtering.whitelistUrls, "list"),
        },
      ],
    },
    {
      id: "custom-rules",
      title: "Custom filter rules",
      href: "/filters/custom-rules",
      description: "Ordered custom filtering rules in the shared draft.",
      change: changeState(
        filtering.userRules,
        active?.shared.filtering.userRules,
      ),
      items: [{ label: "Rules", value: count(filtering.userRules, "rule") }],
    },
    {
      id: "clients",
      title: "Clients",
      href: "/settings/clients",
      description: "Persistent identities and per-client policy overrides.",
      change: changeState(clients, active?.shared.clients),
      items: [
        { label: "Persistent clients", value: count(clients, "client") },
        {
          label: "Identifiers",
          value: count(
            clients.flatMap((client) => client.ids ?? []),
            "identifier",
          ),
        },
        {
          label: "Client-specific blocked services",
          value: count(
            clients.flatMap((client) => client.blockedServices ?? []),
            "selection",
          ),
        },
      ],
    },
    {
      id: "rewrites",
      title: "DNS rewrites",
      href: "/filters/rewrites",
      description: "Desired cluster-wide rewrite records.",
      change: changeState(
        { enabled: document.shared.rewritesEnabled, rewrites },
        active && {
          enabled: active.shared.rewritesEnabled,
          rewrites: active.shared.rewrites,
        },
      ),
      items: [
        { label: "Rewrites", value: yesNo(document.shared.rewritesEnabled) },
        { label: "Records", value: count(rewrites, "rewrite") },
      ],
    },
    {
      id: "services",
      title: "Blocked services",
      href: "/filters/blocked-services",
      description: "Blocked-service schedule and shared safety policy.",
      change: changeState(services, active?.shared.services),
      items: [
        {
          label: "Blocked services",
          value: count(services.blockedServiceIds, "service"),
        },
        {
          label: "Schedule",
          value: `${scheduledDays} active days · ${services.blockedSchedule.timeZone || "Local time"}`,
        },
        { label: "Safe Browsing", value: yesNo(services.safeBrowsing) },
        { label: "Parental control", value: yesNo(services.parentalControl) },
        {
          label: "Safe Search",
          value: `${yesNo(services.safeSearch.enabled)} · ${count(safeSearchProviders, "provider")}`,
        },
      ],
    },
    {
      id: "dhcp",
      title: "Node-specific configuration",
      href: "/settings/dhcp",
      description:
        "Listener identities and guarded DHCP state remain per node.",
      change: changeState(document.nodeOverrides, active?.nodeOverrides),
      items:
        nodeItems.length > 0
          ? nodeItems
          : [{ label: "Node overrides", value: "None" }],
    },
    {
      id: "unsupported",
      title: "Unsupported and retained data",
      href: "/ha/configuration#observations",
      description:
        "Explicitly unowned source data retained for operator review.",
      change: changeState(document.unsupported, active?.unsupported),
      items: [
        {
          label: "Retained entries",
          value: count(document.unsupported, "entry", "entries"),
        },
      ],
    },
  ];
}
