# Release 0.4.1 Phase 9C-3 Implementation

Phase 9C-3 completes the Release 0.4.1 audited operational-command work with
destructive Query Log clearing and Statistics reset.

## Operator outcome

Settings > General exposes Clear Query Log beside Query Log policy and Reset
Statistics beside Statistics policy. Each command defaults to one compatible
enabled node. Operators must deliberately select fleet scope and type the exact
confirmation phrase before the destructive action can run:

```text
CLEAR_QUERY_LOG
RESET_STATISTICS
```

Results identify every targeted node, show stable failures and partial
success, record capability/maintenance exclusions, and separately report a
failed post-command status refresh. Query Log and Statistics enabled state,
retention, anonymisation/ignored-domain policy, mutable draft, active revision,
and revision history remain unchanged.

## Controller contract

```text
POST /api/v1/clusters/{clusterId}/operational-commands/clear-query-log
POST /api/v1/clusters/{clusterId}/operational-commands/reset-statistics
GET  /api/v1/operational-commands/{operationId}
GET  /api/v1/clusters/{clusterId}/operational-commands?command={type}&limit=10
```

POST requests require authentication, matching CSRF state, request IDs, and a
user-scoped UUID `Idempotency-Key`. Targets are frozen when the durable command
is created. Disabled nodes are omitted from fleet targeting; maintenance,
incompatible, stale-profile, and missing-capability nodes are explicit
exclusions. Selected-node scope rejects those conditions before queueing.

The executor invokes only one documented no-body AdGuard operation per target:

```text
POST /control/querylog_clear
POST /control/stats_reset
```

A successful call is followed by a standard configuration observation. This
refresh verifies that configuration remains coherent; it does not adopt state.
Observation failure is recorded separately and does not rewrite a successful
destructive result. Queued work survives restart. Running destructive work
interrupted by restart is marked interrupted and is never automatically
replayed because the node call may already have completed.

## Capability, audit, and error policy

Explicit `querylog_clear` and `stats_reset` capability features are recorded
alongside the existing policy capabilities. Node authentication, TLS,
unreachable/timeout, rejected status, and internal failures are mapped to
stable safe errors. Node URLs, credentials, headers, response bodies, and raw
node error text never enter result or audit resources.

These command capabilities are independent of the newer Query Log and
Statistics policy schemas. Supported schema-v1 nodes can expose
`querylog_clear` and `stats_reset` while the `query_log` and `statistics`
policy capabilities remain unavailable.

Audit action families are:

```text
querylog.clear_requested
querylog.clear_succeeded
querylog.clear_partially_succeeded
querylog.clear_failed

statistics.reset_requested
statistics.reset_succeeded
statistics.reset_partially_succeeded
statistics.reset_failed
```

Audit metadata contains operation/cluster identity, command, explicit scope,
target/exclusion counts, stable terminal counts/errors, and a payload
fingerprint. Reusing the same terminal idempotency key returns the original
resource without a second destructive node call.

## Presentation and release boundaries

Both actions compose `OperationalCommandDialog`, `PartialSuccessPanel`, and
`StatusBadge`. Typed confirmation, focus containment, Escape behavior, loading,
durable failure/partial results, dismissal, mobile layout, and light/dark themes
come from the shared primitives. Completed successful results are not restored
after navigating away.

This phase does not implement Release 0.5 statistics polling, storage, weighted
aggregation, or completeness. It does not implement Release 0.6 query-event
ingestion, search, filtering, or pagination.

Controller tests cover authentication/CSRF, confirmation and scope validation,
capability preflight, safe adapter paths and errors, idempotency, audits,
success/failure/timeout/unreachable/partial results, observation, and per-node
attribution. Frontend tests cover narrow defaults, explicit fleet scope, exact
confirmation, loading/results, partial success, dismissal, unchanged policy,
keyboard interaction, and shared responsive/theme behavior. Integration tests
prove selected-node Query Log clearing, fleet Statistics reset, unchanged
draft/revision records, terminal payload disposal, safe audits, and coherent
post-command observation.
