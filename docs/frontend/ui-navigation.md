# UI Navigation

## Primary route map

```text
/
/statistics

/settings/general
/settings/dns
/settings/encryption
/settings/clients
/settings/dhcp

/filters/blocklists
/filters/allowlists
/filters/rewrites
/filters/blocked-services
/filters/custom-rules

/query-log

/ha/nodes
/ha/configuration
/ha/deployments
/ha/drift
/ha/history

/setup-guide

/system/users
/system/audit
/system/settings
/system/backups
/system/about
```

## Release 0.4.1 Phases 0–2 implementation

Every path above resolves explicitly. Statistics and Query Log identify their
owning future release, and Setup Guide plus unimplemented administration pages
show an explicit planned state. Unknown paths render Not Found and never render
Dashboard.

The horizontal desktop header and mobile drawer share the Settings, Filters,
and HA Controller hierarchy from `navigation-and-shell.md`. The context row
uses existing controller reads for cluster, selected-node scope, active
revision, node health, and active deployment. A context-read failure is shown
as unavailable and does not block the feature page.

Phase 2 established canonical URLs without redesigning Release 0.4 feature
controls. Phase 4 now supersedes the Blocked Services item below; the remaining
items retain their Phase 2 presentation until their assigned migration phase:

- General renders safety services, Safe Search, and the existing query-log and
  statistics policy form;
- Encryption and DHCP each render the existing combined infrastructure form;
- DNS Blocklists, DNS Allowlists, and Custom Filter Rules each render the
  existing combined filtering form;
- Blocked Services renders the dedicated controller-mediated searchable
  catalogue and shared inactivity schedule, with Save Draft as its only write
  action;
- Drift renders the existing combined deployments and drift page;
- Change History renders Configuration Control, where immutable history and
  comparison remain available.

## Route migrations

The browser retains the query string and fragment during these redirects.

| Previous route | Canonical route |
|---|---|
| `/settings/filters` | `/filters/blocklists` |
| `/settings/rewrites` | `/filters/rewrites` |
| `/settings/services` | `/filters/blocked-services` |
| `/settings/privacy` | `/settings/general` |
| `/settings/infrastructure` | `/settings/encryption` |
| `/ha/revisions` | `/ha/history` |
| Any canonical path with a trailing slash | The same path without the trailing slash |

## Configuration Control

`/ha/configuration` is lifecycle control, not a duplicate settings editor. It
contains the complete read-only schema-v2 draft/change summary, validation,
observation and import, publication, immutable revision history and comparison,
deployment preview/deploy, and rollback.

## Route principles

- URLs are stable and bookmarkable.
- Cluster and selected-node scope remain application context; secrets never
  appear in URLs.
- Active submenu children highlight their parent.
- Detail routes may add UUIDs in later releases.
- Unknown routes fail visibly.

## Breadcrumbs

Use breadcrumbs on future detail pages, not top-level pages.

```text
Nodes / AGH Node A
Change History / Revision 42
Deployments / Deployment 8f...
```
