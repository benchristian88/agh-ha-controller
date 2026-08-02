import type { SettingsArea } from "../features/settings/ManagedSettingsPage";

export type RouteResolution =
  | { kind: "dashboard" }
  | { kind: "nodes" }
  | { kind: "configuration" }
  | { kind: "control-plane"; focus: "deployments" | "drift" }
  | { kind: "history" }
  | { kind: "blocked-services" }
  | { kind: "blocklists" }
  | { kind: "allowlists" }
  | {
      kind: "settings";
      area: SettingsArea;
      heading: readonly [title: string, description: string];
    }
  | { kind: "audit" }
  | { kind: "planned"; title: string; release?: string }
  | { kind: "redirect"; to: string }
  | { kind: "not-found" };

export const CANONICAL_PATHS = [
  "/",
  "/statistics",
  "/settings/general",
  "/settings/dns",
  "/settings/encryption",
  "/settings/clients",
  "/settings/dhcp",
  "/filters/blocklists",
  "/filters/allowlists",
  "/filters/rewrites",
  "/filters/blocked-services",
  "/filters/custom-rules",
  "/query-log",
  "/ha/nodes",
  "/ha/configuration",
  "/ha/deployments",
  "/ha/drift",
  "/ha/history",
  "/setup-guide",
  "/system/users",
  "/system/audit",
  "/system/settings",
  "/system/backups",
  "/system/about",
] as const;

export const LEGACY_REDIRECTS: Readonly<Record<string, string>> = {
  "/settings/filters": "/filters/blocklists",
  "/settings/rewrites": "/filters/rewrites",
  "/settings/services": "/filters/blocked-services",
  "/settings/privacy": "/settings/general",
  "/settings/infrastructure": "/settings/encryption",
  "/ha/revisions": "/ha/history",
};

const settingsRoutes: Readonly<
  Record<string, { area: SettingsArea; heading: readonly [string, string] }>
> = {
  "/settings/general": {
    area: "privacy",
    heading: [
      "General settings",
      "Safety services, Safe Search, query-log, and statistics policy managed across the cluster.",
    ],
  },
  "/settings/dns": {
    area: "dns",
    heading: [
      "DNS settings",
      "Shared resolver, cache, blocking, and privacy behavior.",
    ],
  },
  "/settings/encryption": {
    area: "infrastructure",
    heading: [
      "Encryption",
      "Redacted, node-attributed TLS inventory. Certificate secrets remain outside desired state.",
    ],
  },
  "/settings/clients": {
    area: "clients",
    heading: [
      "Persistent clients",
      "Client identities and per-client filtering policy shared by every node.",
    ],
  },
  "/settings/dhcp": {
    area: "dhcp",
    heading: [
      "DHCP",
      "Guarded node-specific DHCP configuration with a single active node.",
    ],
  },
  "/filters/rewrites": {
    area: "rewrites",
    heading: [
      "DNS rewrites",
      "Cluster-wide domain answers managed as an unordered set.",
    ],
  },
  "/filters/custom-rules": {
    area: "filters",
    heading: [
      "Custom filter rules",
      "Ordered cluster-wide custom filtering rules.",
    ],
  },
};

const plannedRoutes: Readonly<
  Record<string, { title: string; release?: string }>
> = {
  "/statistics": { title: "Statistics", release: "Release 0.5" },
  "/query-log": { title: "Query Log", release: "Release 0.6" },
  "/setup-guide": { title: "Setup Guide" },
  "/system/users": { title: "Users" },
  "/system/settings": { title: "System Settings" },
  "/system/backups": { title: "Backups" },
  "/system/about": { title: "About" },
};

export function resolveRoute(pathname: string): RouteResolution {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return { kind: "redirect", to: pathname.replace(/\/+$/, "") };
  }

  const redirect = LEGACY_REDIRECTS[pathname];
  if (redirect !== undefined) return { kind: "redirect", to: redirect };

  const settings = settingsRoutes[pathname];
  if (settings !== undefined) return { kind: "settings", ...settings };

  const planned = plannedRoutes[pathname];
  if (planned !== undefined) return { kind: "planned", ...planned };

  switch (pathname) {
    case "/":
      return { kind: "dashboard" };
    case "/ha/nodes":
      return { kind: "nodes" };
    case "/ha/configuration":
      return { kind: "configuration" };
    case "/ha/deployments":
      return { kind: "control-plane", focus: "deployments" };
    case "/ha/drift":
      return { kind: "control-plane", focus: "drift" };
    case "/ha/history":
      return { kind: "history" };
    case "/filters/blocklists":
      return { kind: "blocklists" };
    case "/filters/allowlists":
      return { kind: "allowlists" };
    case "/filters/blocked-services":
      return { kind: "blocked-services" };
    case "/system/audit":
      return { kind: "audit" };
    default:
      return { kind: "not-found" };
  }
}
