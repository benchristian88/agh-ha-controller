# ADR-0027: Use Query-Backed Inline Details for the HA Revision Lifecycle

## Status

Accepted.

## Date

9 August 2026.

## Context

ADR-0026 established five distinct HA Controller task surfaces and originally
named the immutable-revision surface Change History at `/ha/history`. The
implemented pages subsequently presented revision, deployment, and drift
details in different ways: a detached revision panel, duplicated active and
historical deployment detail, and fully expanded drift cards. Publishing also
left no durable handoff to the exact immutable revision returned by the API.

The backend already exposes the required immutable revisions, deployment
previews, durable deployments, ordered node tasks, semantic differences, and
drift events. No persistence or orchestration change is required.

## Decision

The HA Controller lifecycle navigation is:

```text
Nodes
Configuration Control
Revisions
Deployments
Drift
```

`/ha/revisions` is canonical. `/ha/history` is a compatibility redirect that
preserves query parameters and fragments.

Publishing remains separate from deployment. Configuration Control retains a
persistent success result linked to the exact API-returned revision at
`/ha/revisions?revisionId=<id>`. Revisions requires deployment preview and an
accessible explicit confirmation. A created deployment is opened at
`/ha/deployments?deploymentId=<id>`.

Revisions, Deployments, and Drift use one shared table convention: a compact
summary row followed immediately by at most one expanded detail row. Selected
IDs are URL-backed through `revisionId`, `deploymentId`, and `driftId`. The
complete immutable configuration remains a collapsed secondary disclosure in
revision detail. Deployments uses one unified active-and-historical table; an
optional active summary links to the corresponding row.

## Architecture boundary

This changes routing, presentation, and browser state only. Immutable revision
identity, deployment-based rollback, all-target preflight, sequential
stop-on-failure execution, read-back verification, total-success activation,
drift comparison, adoption-to-draft, maintenance, audit, and secret-redaction
semantics remain governed by ADR-0009, ADR-0011, ADR-0024, and ADR-0026.

## Consequences

- Exact records can be bookmarked, shared, and restored with browser history.
- Polling can update deployment/drift data without losing selection or scroll.
- Operational detail remains visually attached to its summary record.
- Historical `/ha/history` bookmarks remain valid.
- The existing frontend DataTable gains a backward-compatible optional
  expandable-row capability.
- ADR-0026 remains historical evidence for the original route name; this ADR
  supersedes only that presentation terminology and route direction.
