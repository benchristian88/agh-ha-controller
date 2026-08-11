# Release 0.4.1 Phase 9C-2 Implementation

Phase 9C-2 adds an audited, non-mutating host-filtering operational command and
migrates Custom Filter Rules to its specialist presentation.

## Operator outcome

Custom Filter Rules retains ordered rule authoring through Save Draft and adds
Test a host as a separate immediate command. Operators provide a hostname and
may add a client ID/IP and DNS query type. The default target is one compatible
enabled node; fleet scope must be chosen explicitly. Results identify every
node and show the filtering reason, matched rules/filter-list IDs, blocked
service, or rewrite result returned safely by that node.

The command tests filtering state currently active on each node. It does not
apply unsaved draft rules, create a revision, start a deployment, mutate the
draft or active revision, create an observation, or adopt node state.

## Controller contract

```text
POST /api/v1/clusters/{clusterId}/operational-commands/test-host-filtering
GET  /api/v1/operational-commands/{operationId}
GET  /api/v1/clusters/{clusterId}/operational-commands?command=test_host_filtering&limit=10
```

The POST body contains an explicit target and:

```json
{
  "hostname": "ads.example",
  "client": "192.0.2.10",
  "queryType": "AAAA"
}
```

Authentication, CSRF, request IDs, and a user-scoped UUID
`Idempotency-Key` are required. The controller freezes eligible targets,
encrypts the input with AES-256-GCM while queued, invokes only
`GET /control/filtering/check_host`, stores bounded per-node results, and
discards the ciphertext at terminal completion. Queued commands survive
restart; uncertain running commands are interrupted and never replayed
automatically.

## Capability and safety policy

Hostname-only tests require `test_host_filtering`. Optional `client` or
`queryType` requires `test_host_filtering_context`, available from AdGuard Home
v0.107.58. Fleet targeting excludes disabled, maintenance, incompatible, stale
profile, and context-incompatible nodes. A selected incompatible node fails
preflight.

The node response mapper accepts current `rules` entries and the deprecated
single-rule fields for supported older nodes. It returns only bounded reason,
rule text/filter-list ID, service name, rewrite CNAME, and IP-address fields.
Oversized, malformed, multiline-rule, authentication, timeout, unreachable,
and unexpected-status responses become stable safe errors. Raw response bodies,
node URLs, credentials, and raw node errors never enter the API result or audit.

Audit actions are:

```text
filtering.test_host_requested
filtering.test_host_succeeded
filtering.test_host_partially_succeeded
filtering.test_host_failed
```

Audit metadata contains only command identity, scope/counts, stable error
codes, and an input fingerprint. Hostname and client input are excluded.

## Presentation and tests

The page composes `RuleEditor`, `OperationalCommandDialog`,
`PartialSuccessPanel`, and `StatusBadge`. The dialog shows exact scope and node,
validates before submission, supports keyboard dismissal/focus containment,
and adapts through shared mobile/theme styles. Terminal failures and partial
results survive an accidental reload and are dismissible; completed successful
tests are not restored after navigating away.

Controller tests cover validation, capabilities, encryption, redacted audits,
idempotency, safe response mapping, success/failure/timeout/unreachable and
partial node results. Frontend tests cover all form inputs, narrow/fleet scope,
loading/result states, partial success, compatibility changes, keyboard/mobile
behavior, ordered rule saving, and successful-result cleanup. Integration
coverage verifies node-attributed matched rules and proves drafts and revisions
remain unchanged.
