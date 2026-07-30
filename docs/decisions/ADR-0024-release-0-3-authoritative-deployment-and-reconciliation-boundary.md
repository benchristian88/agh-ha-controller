# ADR-0024: Define the Release 0.3 authoritative deployment and reconciliation boundary

**Status:** Accepted

**Date:** 2026-07-30

**Related release:** 0.3

## Context

Release 0.2 froze an observed per-node schema and a non-authoritative import draft. Release 0.3 must make the controller authoritative without editing AdGuard Home files, confusing observed state with intent, or allowing a partially verified rollout to become the active cluster revision.

AdGuard Home's supported HTTP API can update the schema-v1 shared DNS resolver and filtering fields. It does not expose a supported writer for DNS bind hosts or the DNS listener port.

## Decision

- Keep observed schema-v1 `Document` values separate from authoritative `DesiredDocument` values. Desired documents contain shared DNS/filtering policy and a `nodeOverrides` map keyed by node UUID; they never contain observed-only product versions.
- Publishing creates an immutable `configuration_revisions` row. A revision becomes active only after every targeted enabled, non-maintenance node succeeds in one durable sequential deployment.
- Validate and freshly observe every target before the first mutation. Stop after the first node failure. Preserve partial success explicitly and do not perform a silent automatic rollback.
- Apply only supported HTTP API fields, then re-observe and require semantic equality. Bind host or port differences fail preflight; the controller never edits AdGuard Home YAML.
- Cancellation takes effect only between node tasks. Controller restart marks in-flight deployments and tasks interrupted; it never guesses whether an interrupted mutation succeeded.
- PostgreSQL permits only one queued or active deployment per cluster. Drift evaluation skips that cluster until the deployment reaches a terminal state, preventing stale active intent from racing a rollout.
- Rollback is a new deployment of an existing immutable revision.
- Drift events are durable and deduplicated by node and semantic fingerprint. `manual`, `alert`, and `enforce` are cluster policies. Enforce creates the same durable, verified deployment used by an operator. Maintenance always suppresses mutation.
- Whitelist subscriptions are outside schema-v1 managed blocklists and are never disabled by the writer.

## Consequences

- DNS continues independently when the controller is unavailable.
- Deployment history records per-node attempts, safe errors, effective hashes, and verification snapshots.
- Listener changes require direct node administration and a subsequent observed override import until a supported API exists.
- A failure after an earlier node succeeds is visible as `partially_succeeded`; recovery is an explicit later deployment or rollback.
- The initial worker is in-process but all checkpoints are PostgreSQL-backed, allowing later worker separation.

## Deferred

- Parallel/rolling strategies, scheduled maintenance windows, field-level drift ignore rules, operator-selectable partial recovery, and broader AdGuard Home configuration remain later releases.
- Automatic retry within one node mutation is withheld because filter-list mutation is not safely replayable across every partial failure. Enforce mode may create a later fresh attempt after a new observation.
