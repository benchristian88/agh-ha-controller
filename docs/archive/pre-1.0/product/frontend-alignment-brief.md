# Frontend Product Alignment Brief

## Status

Approved direction for Release 0.4.1.

## Product objective

Make AGH HA Controller feel like AdGuard Home extended for multiple nodes, desired-state configuration, safe deployment, and drift management.

The controller should preserve AdGuard Home's operator-facing product concepts while adding explicit HA context.

## Problem statement

Release 0.4 has a sound control-plane architecture:

```text
Settings UI
→ optimistic schema-v2 draft
→ validation and capability preflight
→ immutable revision
→ durable sequential deployment
→ version-aware AdGuard Home API writes
→ read-back verification
→ drift detection and reconciliation
```

The primary weakness is presentation:

- navigation does not match the familiar AdGuard Home hierarchy;
- several structured concepts are exposed as textareas or large inline forms;
- Configuration Control still presents stale schema-v1 language and a duplicate narrow editor;
- context such as active revision, selected node, cluster health, and active deployment is not globally visible;
- unknown paths can silently render Dashboard;
- the UI sometimes reflects API transport types instead of operator concepts.

The architecture above must remain intact.

## Approved navigation

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

Release 0.5 owns Statistics functionality and Release 0.6 owns the combined
Query Log. Both now implement dedicated, scope-aware routes and neither may
silently fall through to Dashboard.

## Product rules

### Preserve familiar product concepts

Where AdGuard Home presents a catalogue, table, switch, schedule, structured list, or specialist editor, the controller should use the equivalent operator concept rather than exposing raw IDs or JSON-like transport structures.

### Extend rather than replace

Every familiar setting may add:

- shared versus node-specific scope;
- affected nodes;
- active revision;
- draft state;
- capability warning;
- deployment status;
- drift state;
- partial success.

### Keep lifecycle actions distinct

- Save Draft: changes controller draft only.
- Publish Revision: creates immutable revision.
- Deploy: mutates nodes.
- Verify: confirms effective state.
- Restore/Adopt: resolves drift.

### Keep operational commands separate

Commands such as cache clear, upstream test, filter refresh, query-log clear, and statistics reset are operational actions. They require explicit scope, auditing, safe errors, and per-node results. They do not automatically belong in configuration revisions.

## Highest-priority presentation changes

1. Routing and not-found safety.
2. Configuration Control schema-v2 reconciliation.
3. Horizontal navigation and context row.
4. Blocked Services catalogue.
5. Blocklist and allowlist tables.
6. Clients table and dialogs.
7. Rewrite table and dialogs.
8. DHCP interface discovery, leases, and safety actions.
9. Shared structured controls for durations, networks, lists, status, and dialogs.

## Non-goals

- Copying AdGuard Home source code or brand assets.
- Rewriting the backend desired-state engine.
- Removing capability-aware deployment.
- Making TLS secrets browser-editable.
- Implementing active-active DHCP.
- Implementing Release 0.5 or 0.6 data pipelines during the UI alignment milestone.
