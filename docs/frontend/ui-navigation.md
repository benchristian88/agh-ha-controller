# UI Navigation

This is the canonical route and route-ownership reference. Visual shell and
menu interaction details are defined in
[Navigation and Application Shell](navigation-and-shell.md).

## Current route map

| Route | Owner |
|---|---|
| `/` | Dashboard |
| `/statistics` | Statistics |
| `/settings/general` | General settings |
| `/settings/dns` | DNS settings |
| `/settings/encryption` | Encryption status and node-local guidance |
| `/settings/clients` | Persistent clients |
| `/settings/dhcp` | DHCP configuration and static leases |
| `/filters/blocklists` | DNS blocklists |
| `/filters/allowlists` | DNS allowlists |
| `/filters/rewrites` | DNS rewrites |
| `/filters/blocked-services` | Blocked services |
| `/filters/custom-rules` | Custom filter rules |
| `/query-log` | Combined node-attributed Query Log |
| `/ha/nodes` | Managed node inventory |
| `/ha/nodes/{nodeId}` | Node lifecycle detail |
| `/ha/operations` | Fleet HA operations |
| `/ha/configuration` | Configuration Control |
| `/ha/revisions` | Immutable configuration revisions |
| `/ha/deployments` | Deployment execution and per-node results |
| `/ha/drift` | Current convergence and drift resolution |
| `/setup-guide` | State-derived setup guidance |
| `/system/users` | Administrator accounts |
| `/system/audit` | Audit log |
| `/system/operational-status` | Controller operational status |
| `/system/settings` | System settings and update awareness |
| `/system/backups` | Backup and restore |
| `/system/updates` | Controller update awareness and host guidance |
| `/system/about` | Build and product information |

## Menu ownership

- Dashboard, Statistics, Query Log, and Setup Guide are primary destinations.
- Settings owns General, DNS, Encryption, Clients, and DHCP.
- Filters owns Blocklists, Allowlists, Rewrites, Blocked Services, and Custom
  Filter Rules.
- HA Controller owns Nodes, Configuration Control, Revisions, Deployments, and
  Drift.
- The administration menu owns Users, Operational Status, HA Operations, Audit
  Log, System Settings, Backups, About, and Sign Out.

Desktop and mobile use the same labels, ordering, and parent/child relationships.
An active child highlights its owning menu.

## Compatibility redirects

The browser retains query strings and fragments while redirecting.

| Previous route | Canonical route |
|---|---|
| `/settings/filters` | `/filters/blocklists` |
| `/settings/rewrites` | `/filters/rewrites` |
| `/settings/services` | `/filters/blocked-services` |
| `/settings/privacy` | `/settings/general` |
| `/settings/infrastructure` | `/settings/encryption` |
| `/ha/history` | `/ha/revisions` |
| Any canonical path with a trailing slash | The same path without the trailing slash |

## Configuration Control

`/ha/configuration` is lifecycle control, not a duplicate settings editor. It
contains the complete read-only draft/change summary, validation, advanced
observation and import/adoption, and immutable publication. Revision comparison
and rollback belong to `/ha/revisions`; execution belongs to `/ha/deployments`;
continuing divergence belongs to `/ha/drift`.

## Navigation behavior

- Routes are stable and bookmarkable.
- Cluster and selected-node scope remain application context; secrets never
  appear in URLs.
- Revision, deployment, and drift selection use `revisionId`, `deploymentId`,
  and `driftId` query parameters and preserve unrelated query state.
- Unknown routes render an explicit Not Found page and never Dashboard.
- Desktop menus support pointer and keyboard operation; mobile disclosures do
  not depend on hover.
- Escape closes an open menu or drawer and restores focus to its trigger.
- Breadcrumbs are reserved for detail views rather than top-level pages.

Historical route migration and phase evidence is retained in the
[pre-1.0 frontend implementation archive](../archive/pre-1.0/frontend/implementation/).
