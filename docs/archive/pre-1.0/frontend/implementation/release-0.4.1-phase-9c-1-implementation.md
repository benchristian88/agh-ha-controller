# Release 0.4.1 Phase 9C-1 Implementation

Phase 9C-1 adds audited DNS operational commands without changing the desired
configuration lifecycle.

## Operator outcome

DNS Settings can test resolver values currently visible in the draft editor
without saving or applying them. Operators can target one compatible enabled
node or explicitly choose all compatible enabled nodes. Results retain node and
resolver attribution.

DNS Settings also provides a confirmed Clear DNS Cache command. Its default
scope is one node. Fleet scope must be selected explicitly, results are durable,
and successful nodes receive a fresh configuration observation.

Neither command creates a revision, changes the draft or active revision,
starts a deployment, or adopts observed state.

## Controller boundary

The browser calls only cluster-scoped controller endpoints. The controller
resolves and freezes eligible nodes, encrypts resolver input while queued,
persists per-node progress, decrypts node credentials only at execution time,
and maps node responses to bounded result DTOs. Terminal operations discard the
encrypted payload and retain only a fingerprint.

Queued commands survive restart. A command already running when the controller
restarts is marked interrupted and is not replayed automatically because a
destructive node call may already have completed.

The existing filter-refresh and DHCP command routes and contracts are
unchanged. Migration `000006_release_0_4_1_dns_operations` extends their shared
tables append-only.

## Presentation and security

Both actions compose `OperationalCommandDialog`. Mixed fleet outcomes compose
`PartialSuccessPanel`, followed by durable node and resolver details. All POSTs
require authentication, CSRF, and a user-scoped UUID `Idempotency-Key`.

Audit events contain command identity, scope, counts, safe error codes, and an
input fingerprint. Resolver strings, credentials, node URLs, raw node errors,
and raw node responses are excluded.
