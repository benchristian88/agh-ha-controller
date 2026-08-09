export interface NavigationLink {
  label: string;
  href: string;
}

export interface NavigationGroup {
  label: string;
  children: readonly NavigationLink[];
}

export const PRIMARY_NAVIGATION: readonly (NavigationLink | NavigationGroup)[] =
  [
    { label: "Dashboard", href: "/" },
    { label: "Statistics", href: "/statistics" },
    {
      label: "Settings",
      children: [
        { label: "General", href: "/settings/general" },
        { label: "DNS", href: "/settings/dns" },
        { label: "Encryption", href: "/settings/encryption" },
        { label: "Clients", href: "/settings/clients" },
        { label: "DHCP", href: "/settings/dhcp" },
      ],
    },
    {
      label: "Filters",
      children: [
        { label: "DNS Blocklists", href: "/filters/blocklists" },
        { label: "DNS Allowlists", href: "/filters/allowlists" },
        { label: "DNS Rewrites", href: "/filters/rewrites" },
        { label: "Blocked Services", href: "/filters/blocked-services" },
        { label: "Custom Filter Rules", href: "/filters/custom-rules" },
      ],
    },
    { label: "Query Log", href: "/query-log" },
    {
      label: "HA Controller",
      children: [
        { label: "Nodes", href: "/ha/nodes" },
        { label: "Configuration Control", href: "/ha/configuration" },
        { label: "Revisions", href: "/ha/revisions" },
        { label: "Deployments", href: "/ha/deployments" },
        { label: "Drift", href: "/ha/drift" },
      ],
    },
    { label: "Setup Guide", href: "/setup-guide" },
  ];

export const ADMINISTRATION_NAVIGATION: readonly NavigationLink[] = [
  { label: "Operational Status", href: "/system/operational-status" },
  { label: "Users", href: "/system/users" },
  { label: "Audit Log", href: "/system/audit" },
  { label: "System Settings", href: "/system/settings" },
  { label: "Backups", href: "/system/backups" },
  { label: "About", href: "/system/about" },
];

export function isNavigationGroup(
  item: NavigationLink | NavigationGroup,
): item is NavigationGroup {
  return "children" in item;
}

export function isGroupActive(
  group: NavigationGroup,
  pathname: string,
): boolean {
  return group.children.some((child) => child.href === pathname);
}
