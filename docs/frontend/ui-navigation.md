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
/ha/revisions
/ha/deployments
/ha/drift

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

Phase 10 confirmed every selected feature route used its migrated
operator-facing presentation. The 3 August 2026 responsibility pass then
removed its two remaining combined-page compromises: Deployments and Drift now
render distinct execution and convergence pages, and Revisions no longer
renders Configuration Control. They continue to share typed controller APIs
and semantic presentation primitives. Release 0.5 subsequently replaces the
Statistics planned state with the complete fixed-range, global-scope
experience; Query Log remains the explicit Release 0.6 planned state.

## Route migrations

The browser retains the query string and fragment during these redirects.

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
contains the complete read-only schema-v2 draft/change summary, validation,
advanced observation and import/adoption, and immutable publication. Revision
history/comparison/rollback belong to `/ha/revisions`; execution progress belongs
to `/ha/deployments`; continuing divergence belongs to `/ha/drift`.

## Route principles

- URLs are stable and bookmarkable.
- Cluster and selected-node scope remain application context; secrets never
  appear in URLs.
- Active submenu children highlight their parent.
- Revision, deployment, and drift selection use `revisionId`, `deploymentId`,
  and `driftId` query parameters and preserve unrelated query state.
- Unknown routes fail visibly.

## Breadcrumbs

Use breadcrumbs on future detail pages, not top-level pages.

```text
Nodes / AGH Node A
Revisions / Revision 42
Deployments / Deployment 8f...
```
