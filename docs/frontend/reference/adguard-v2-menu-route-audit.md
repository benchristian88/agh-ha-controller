> Status: Reference material.
>
> This document records the AdGuard Home upstream UI and API model.
> It is not the authoritative implementation specification for Atlas DNS Controller.
> For current controller design decisions, see:
> - [ADR-0026](../../decisions/ADR-0026-adopt-adguard-v2-inspired-ui-language.md)
> - [navigation and shell](../navigation-and-shell.md)
> - [feature presentation rules](../feature-presentation-rules.md)
> - [design system](../design-system.md)


# AdGuard Home v2 Menu and Route Audit

## Purpose

Record the current AdGuard Home user-facing information architecture and define the matching Atlas DNS Controller navigation.

## 1. Current AdGuard Home product areas

The current `client_v2/src/components` tree contains these principal product modules:

| Component area | Product function | Status |
|---|---|---|
| `Dashboard` | Operational overview and protection state | Verified |
| `Settings` | General protection, filtering, statistics, and query-log settings | Verified |
| `DnsSettings` | DNS server and resolver configuration | Verified |
| `Encryption` | TLS, DoH, DoT, and DoQ configuration | Verified |
| `Clients` | Persistent clients and access policy | Verified |
| `Dhcp` | DHCP configuration, leases, and interface checks | Verified |
| `FilterLists` | DNS blocklists and allowlists | Verified |
| `BlockedServices` | Selectable service catalogue and inactivity schedule | Verified |
| `UserRules` | Custom filtering rules | Verified |
| `QueryLog` | Searchable DNS query log | Verified |
| `SetupGuide` | Client and router setup instructions | Verified |

## 2. AdGuard Home navigation model

The operator-facing navigation should be treated as:

```text
Dashboard

Settings
├── General
├── DNS
├── Encryption
├── Clients
└── DHCP

Filters
├── DNS Blocklists
├── DNS Allowlists
├── DNS Rewrites
├── Blocked Services
└── Custom Filter Rules

Query Log

Setup Guide
```

## 3. Recommended Atlas DNS Controller navigation

```text
Dashboard
Statistics

Settings
├── General
├── DNS
├── Encryption
├── Clients
└── DHCP

Filters
├── DNS Blocklists
├── DNS Allowlists
├── DNS Rewrites
├── Blocked Services
└── Custom Filter Rules

Query Log

HA Controller
├── Nodes
├── Configuration Control
├── Deployments
├── Drift
└── Change History

Setup Guide
```

## 4. Recommended route map

| Menu | Suggested controller route | Scope default |
|---|---|---|
| Dashboard | `/` | Entire Cluster |
| Statistics | `/statistics` | Entire Cluster |
| General | `/settings/general` | Entire Cluster |
| DNS | `/settings/dns` | Entire Cluster |
| Encryption | `/settings/encryption` | Entire Cluster, with node overrides |
| Clients | `/settings/clients` | Entire Cluster |
| DHCP | `/settings/dhcp` | Selected node or designated DHCP node |
| DNS Blocklists | `/filters/blocklists` | Entire Cluster |
| DNS Allowlists | `/filters/allowlists` | Entire Cluster |
| DNS Rewrites | `/filters/rewrites` | Entire Cluster |
| Blocked Services | `/filters/blocked-services` | Entire Cluster |
| Custom Filter Rules | `/filters/custom-rules` | Entire Cluster |
| Query Log | `/query-log` | Entire Cluster |
| Nodes | `/ha/nodes` | Entire Cluster |
| Configuration Control | `/ha/configuration` | Entire Cluster |
| Deployments | `/ha/deployments` | Entire Cluster |
| Drift | `/ha/drift` | Entire Cluster |
| Change History | `/ha/history` | Entire Cluster |
| Setup Guide | `/setup-guide` | Cluster-aware |

## 5. Context navigation

The product navigation answers **which function** the operator is using.

A separate context row answers **which target** the operator is managing:

```text
[Cluster: Home DNS ▾] [Scope: Entire Cluster ▾] Revision 24  ● Healthy
```

Required context values:

- active cluster;
- Entire Cluster or selected node;
- active revision;
- cluster health;
- active deployment status.

## 6. Menu implementation rules

- Use horizontal desktop navigation.
- Use dropdown menus for Settings, Filters, and HA Controller.
- Highlight a parent menu when a child route is active.
- Use the same hierarchy in the mobile drawer.
- Do not place routine AdGuard Home settings under HA Controller.
- Do not place revisions or drift inside generic Settings.
- Retain old routes with redirects where necessary.
- Keep lower-frequency controller administration under the user/system menu:
  - Users
  - Audit Log
  - System Settings
  - Backups
  - About
  - Sign Out

## 7. Route parity audit checklist

For each route in the Codex implementation:

| Check | Required |
|---|---|
| Route maps to the correct top-level menu | Yes |
| Page title matches operator terminology | Yes |
| Existing bookmark redirect exists after route change | Where needed |
| Cluster/node scope is visible | Yes |
| Parent dropdown is marked active | Yes |
| Mobile hierarchy matches desktop | Yes |
| Page does not expose raw API structures by default | Yes |

## Audit basis

This audit uses the current `master` branch of:

- `client_v2/src/components`
- `client_v2/src/components/Routes`
- `openapi/openapi.yaml`

Repository:

- https://github.com/AdguardTeam/AdGuardHome

The OpenAPI specification states that the AdGuard Home administrative web interface is built on the REST API. The v2 frontend contains separate feature components for Dashboard, Settings, DNS Settings, Encryption, Clients, DHCP, Filter Lists, Blocked Services, Query Log, User Rules, and Setup Guide.

### Confidence labels

- **Verified** — route, feature component, and API operation are confirmed in the repository.
- **High confidence** — API mapping and visible product behaviour are clear, but an exact current screen label or widget should be visually checked.
- **Needs visual verification** — the API operation is known, but the exact v2 control needs confirmation from a running AdGuard Home instance or screenshots.

This is a design audit, not a recommendation to copy AdGuard Home source code or branding.
