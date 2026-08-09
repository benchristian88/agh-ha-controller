# Navigation and Application Shell

## Desktop header

Use horizontal desktop navigation.

```text
Brand | Dashboard | Statistics | Settings ▾ | Filters ▾ | Query Log
      | HA Controller ▾ | Setup Guide                   User/System
```

### Settings menu

- General
- DNS
- Encryption
- Clients
- DHCP

### Filters menu

- DNS Blocklists
- DNS Allowlists
- DNS Rewrites
- Blocked Services
- Custom Filter Rules

### HA Controller menu

- Nodes
- Configuration Control
- Revisions
- Deployments
- Drift

## Context row

Immediately below the main header:

```text
[Cluster: Home DNS ▾] [Scope: Entire Cluster ▾] Revision 24  ● Healthy
```

Optional active operation:

```text
Deployment 8f3… Applying Node B
```

Required context:

- cluster selector;
- Entire Cluster or selected node;
- active revision;
- cluster health;
- active deployment.

## Route map

```text
/                           Dashboard
/statistics                 Statistics
/settings/general           General
/settings/dns               DNS
/settings/encryption        Encryption
/settings/clients           Clients
/settings/dhcp              DHCP
/filters/blocklists         DNS Blocklists
/filters/allowlists         DNS Allowlists
/filters/rewrites           DNS Rewrites
/filters/blocked-services   Blocked Services
/filters/custom-rules       Custom Filter Rules
/query-log                  Query Log
/ha/nodes                   Nodes
/ha/configuration           Configuration Control
/ha/revisions               Configuration Revisions
/ha/deployments             Deployments
/ha/drift                   Drift
/setup-guide                Setup Guide
```

## Route migration rules

- Existing routes must redirect to new canonical routes where appropriate.
- Unknown paths render an explicit Not Found page.
- Unknown paths must never render Dashboard.
- Browser bookmarks should remain usable through redirects.
- Active submenu child highlights its parent.
- The mobile drawer uses the same labels and hierarchy.
- Route scope and selected node may use route/query state, but secrets never appear in URLs.

## Mobile

- Compact top header.
- Hamburger opens drawer.
- Settings, Filters, and HA Controller become expandable sections.
- Context row remains visible or opens as a dedicated context sheet.
- No mobile-only alternate hierarchy.

## Administration menu

Lower-frequency controller administration:

- Users
- Operational Status
- HA Operations

`/ha/operations` is the fleet-level lifecycle surface: verified DNS capacity,
API/convergence/maintenance counts, certificate/version warnings, upgrade
history, notification configuration, and HA events. `/ha/nodes/{nodeId}` is the
node lifecycle detail for probe settings, preflight, maintenance, return checks,
certificate/version state, guided upgrades, and node-attributed history. The
existing `/nodes` page remains infrastructure inventory and links to detail.
- Audit Log
- System Settings
- Backups
- About
- Sign Out

Release 0.9 completes Users, Audit Log, Operational Status, System Settings,
Backup & Restore, Updates, and About. Setup Guide remains in primary navigation
and derives checks from enabled nodes, observations, draft, immutable revisions,
successful deployment, Statistics, Query Log, and HA state. No completed check
is based solely on visiting a route.

The login and shell share a neutral diamond/network mark. Browser favicon,
Apple touch icon, 192/512 PWA icons, and `manifest.webmanifest` retain AGH HA
Controller naming. No service worker or offline data cache is introduced.

## Configuration Control purpose

`/ha/configuration` is not another settings editor.

It should provide:

- complete draft summary;
- validation status;
- links to authoring pages;
- active revision summary;
- observation and import/adoption workflow;
- publication;
- deployment preview;
- a persistent link to the exact published revision and links to Deployments.

The current implementation removes stale schema-v1 wording and the narrow
duplicate DNS/filter editor.

## HA Controller page responsibilities

- `/ha/nodes`: managed node identity, health, compatibility, availability,
  observation freshness, applied revision, and convergence indicators.
- `/ha/configuration`: forward-looking draft review, validation, publication,
  and advanced observation/import/adoption only.
- `/ha/revisions`: immutable revision history, adjacent inline detail,
  semantic comparison, deployment preview/confirmation, and deployment of a
  historical revision as rollback.
- `/ha/deployments`: one unified durable execution table, active progress, ordered
  per-node tasks, safe errors, cancellation, and verification.
- `/ha/drift`: current convergence summary, semantic desired-versus-observed
  incidents, policy, restore, adopt, and maintenance.

`/ha/history` redirects to `/ha/revisions` while preserving its query string
and fragment.
