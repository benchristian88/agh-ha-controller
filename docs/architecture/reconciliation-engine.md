# Reconciliation Engine

## Purpose

The reconciliation engine continuously compares desired cluster state with observed node state and moves managed nodes toward convergence.

## Inputs

- Active desired revision.
- Node-specific overrides.
- Node capability profile.
- Latest observed state.
- Cluster reconciliation policy.
- Node maintenance state.
- Retry and backoff state.

## Reconciliation policies

### Enforce

Record drift and automatically restore desired state.

### Alert

Record drift and notify the operator. Do not change the node.

### Manual

Record drift and require the operator to choose restore, adopt, or ignore.

## Node state machine

```text
Unknown
  -> Healthy
  -> Unreachable
  -> Incompatible
  -> Drifted
  -> Applying
  -> Verifying
  -> Converged
  -> ApplyFailed
  -> Maintenance
```

## Reconciliation algorithm

1. Acquire a node-scoped reconciliation lock.
2. Confirm node is not in maintenance.
3. Load active desired revision.
4. Build effective configuration for the node.
5. Load or refresh capabilities.
6. Validate effective configuration.
7. Fetch observed state.
8. Canonicalise desired and observed state.
9. Compare hashes and structured values.
10. If converged, update status and stop.
11. Record drift event.
12. Apply reconciliation policy.
13. For enforcement:
    - Create an automatic deployment attempt.
    - Apply configuration in safe order.
    - Re-read state.
    - Verify semantic equality.
    - Record success or failure.
14. Release lock.

## Safe application order

Where API capabilities allow, prefer:

1. Non-disruptive policy changes.
2. Filters and rules.
3. Clients and rewrites.
4. DNS settings.
5. TLS and listener changes.
6. Restart-required changes.

Each category must define rollback or recovery behaviour.

## Concurrency

- Only one active deployment or reconciliation mutation per node.
- Multiple nodes may be processed concurrently in later releases.
- Revision creation must use optimistic concurrency.
- A new active revision must not invalidate an in-progress deployment without explicit handling.

## Retry behaviour

Retry transient errors:

- Connection timeout.
- Temporary DNS failure.
- HTTP 429.
- HTTP 502, 503, or 504.
- Controller restart during an idempotent phase.

Do not automatically retry:

- Authentication failure.
- Unsupported configuration.
- Validation failure.
- Certificate mismatch.
- Semantic verification failure without re-observation.

## Drift suppression

Some observed fields may change without operator action.

The canonical model must suppress:

- Runtime counters.
- Last-update timestamps.
- Temporary service state.
- Version-generated defaults that are semantically equivalent.
- Node-generated IDs that are not configuration identity.

Suppression rules must be tested against real AdGuard Home versions.
