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

1. Select an enabled node under the single in-process reconciliation pass.
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
14. Leave the durable event open until a later observation proves convergence.

## Release 0.3 implementation

The controller process runs a periodic evaluator and a separate durable deployment executor. Evaluation re-observes each enabled, non-maintenance node in a cluster with an active revision. Semantic differences create or refresh one open `drift_events` row keyed by node and fingerprint. Manual records the event, Alert records it as alerted, and Enforce queues a targeted reconciliation deployment. A successful later observation resolves all open drift for the node with an audit event.

Deployment claims use PostgreSQL `FOR UPDATE SKIP LOCKED`, and a partial unique index permits only one queued/active deployment per cluster. Drift evaluation skips clusters with active work so it cannot queue the prior active revision during a rollout. Per-node execution is sequential. Cancellation is honored only between node tasks. Startup converts validating/running/cancelling deployments to `interrupted`; it does not replay an unknown mutation. A failed Enforce attempt becomes eligible for a fresh attempt after a later observation. Immediate blind retries inside a possibly partial filter mutation are deliberately deferred.

## Release 0.4 schema and DHCP behavior

Current observations are projected to the active revision's schema before comparison. Convergence and drift use only `shared_managed` and `node_specific_managed` differences; redacted TLS status, dynamic leases, product version, and unsupported-capability explanations cannot create drift. Schema-v1 revisions therefore continue to verify and reconcile after the adapter begins collecting schema v2.

Schema-v2 preview requires every managed feature to have been successfully observed on every target. DHCP configuration is node-managed and may be enabled on at most one override. Full-cluster deployments sort disabled DHCP targets before the enabled target. Targeted Enforce deployments retain the desired node's effective DHCP state and all normal preflight/read-back rules.

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
