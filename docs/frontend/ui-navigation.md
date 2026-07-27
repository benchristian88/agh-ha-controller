# UI Navigation

## Primary route map

```text
/
  dashboard

/query-log
/statistics

/settings/dns
/settings/filters
/settings/clients
/settings/rewrites
/settings/services
/settings/safety

/ha/nodes
/ha/configuration
/ha/revisions
/ha/deployments
/ha/drift
/ha/forwarders

/system/users
/system/audit
/system/settings
/system/about
```

## Release 0.1 routes

The implemented shell currently exposes:

```text
/
  setup or login when unauthenticated
  cluster health dashboard when authenticated

/ha/nodes
/system/audit
```

Cluster selection remains global application state. Later documented routes are intentionally not rendered as placeholder navigation; they appear when their backend workflows are implemented.

## Route principles

- URLs should be stable and bookmarkable.
- Cluster scope should be represented in application state and optionally URL query parameters.
- Node-specific views should use node UUIDs.
- Revision, deployment, and drift resources should have detail routes.
- Sensitive values must never be placed in URLs.

## Breadcrumbs

Use breadcrumbs on detail pages, not on top-level pages.

Examples:

```text
Nodes / AGH Node A
Change history / Revision 42
Deployments / Deployment 8f...
```
