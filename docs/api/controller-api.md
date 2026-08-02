# Controller API

## Release 0.4 contract

The controller serves its browser UI and JSON API from the same origin. JSON routes are versioned under:

```text
/api/v1
```

`GET /health` and `GET /ready` are intentionally unversioned operational probes.

Every response includes `X-Request-ID`. API responses use `Cache-Control: no-store` and standard browser security headers.

## Authentication and CSRF

Successful setup or login creates:

- `aghha_session`: opaque, HTTP-only, SameSite=Strict session cookie;
- `aghha_csrf`: opaque, SameSite=Strict CSRF cookie readable by the UI.

Cookies are marked Secure when `PUBLIC_BASE_URL` uses HTTPS. Authenticated `POST`, `PATCH`, and `DELETE` requests must copy the CSRF cookie into `X-CSRF-Token`. Only HMAC-SHA-256 hashes of both tokens are stored.

## Errors

```json
{
  "error": {
    "code": "NODE_UNREACHABLE",
    "message": "The AdGuard Home node could not be reached.",
    "field": "baseUrl",
    "requestId": "9ed26873-80f8-4e88-af55-53249687428e"
  }
}
```

`field` is present only for field-specific validation. Stable categories include validation, not found, conflict, authentication, authorisation, rate limiting, node authentication, node TLS, node unreachable, invalid node response, and internal failure.

## Public setup and authentication routes

```text
GET  /api/v1/setup/status
POST /api/v1/setup
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Setup status reports whether setup is required, the configured public URL, controller time, cookie security mode, and prerequisite checks. Initial setup is serialized in PostgreSQL and cannot be repeated after the first user exists.

Login is rate-limited by source address and normalized account identifier. Login failures do not reveal whether an account exists.

## Cluster routes

```text
GET   /api/v1/clusters
POST  /api/v1/clusters
GET   /api/v1/clusters/{clusterId}
PATCH /api/v1/clusters/{clusterId}
```

Create accepts `name` and `description`. Update accepts the complete mutable representation plus `version`. A stale version returns HTTP 409. Responses include an integer `version` and an ETag.

Cluster deletion is deliberately not included in Release 0.1 because safe behavior for historical configuration, deployment, and audit relationships belongs to a later lifecycle design.

## Node routes

```text
GET    /api/v1/clusters/{clusterId}/nodes
POST   /api/v1/clusters/{clusterId}/nodes
GET    /api/v1/nodes/{nodeId}
PATCH  /api/v1/nodes/{nodeId}
DELETE /api/v1/nodes/{nodeId}
POST   /api/v1/nodes/{nodeId}/test-connection
POST   /api/v1/nodes/{nodeId}/filter-refresh
GET    /api/v1/nodes/{nodeId}/dhcp/interfaces
POST   /api/v1/nodes/{nodeId}/dhcp/active-check
```

Create and update use:

```json
{
  "name": "Node A",
  "baseUrl": "https://node-a.example.test",
  "certificatePolicy": "system",
  "customCaPem": "optional write-only PEM",
  "credentials": {
    "username": "write-only",
    "password": "write-only"
  },
  "enabled": true,
  "recordVersion": 1
}
```

`credentials` are required on create and optional on update. If supplied on update, username and password must be supplied together and the action is audited as credential rotation. `customCaPem` is required when first selecting `custom_ca`, is write-only, and may be omitted on later updates to retain it.

Before saving an enabled node, the controller verifies status, authentication, TLS policy, version, and DNS running state. Configuration changes occur only through explicit Release 0.3 deployment resources.

Node responses include identity, URL, trust policy, enabled state, health, compatibility, version, polling timestamps, latency, safe error code, and `recordVersion`. They never include credentials, ciphertext, nonces, CA contents, or authentication headers. The cluster node-list envelope also includes `refreshedAt` and `staleAfterSeconds`; the latter is three configured health intervals so the UI freshness state follows runtime polling configuration.

The manual `test-connection` action atomically stores its safe observed result and an audit event with a success or failure outcome. Background interval polls update health without generating high-volume audit records.

The DHCP interface route performs a bounded, authenticated, node-specific read
and returns safe interface names, hardware addresses, IP addresses, gateway,
flags, controller-derived availability, and `fetchedAt`. The result is volatile
presentation metadata: it is not stored in desired configuration, revisions,
canonical hashes, or drift state. An unavailable or malformed AdGuard endpoint
returns a stable capability or node-response error; a legacy desired interface
remains the draft value.

The active-DHCP route accepts `{ "interfaceName": "eth0" }` and invokes the
node-specific, non-mutating AdGuard detection operation. It returns aggregate
`none`, `found`, `multiple`, `partial`, or `error` status plus safe IPv4,
IPv4-static-IP, and IPv6 results and `checkedAt`. Raw upstream error text is
discarded. The operation requires CSRF, an enabled node outside maintenance,
and records `dhcp.active_check_requested` followed by exactly one
`dhcp.active_check_succeeded` or `dhcp.active_check_failed` audit event. It
never changes the draft, publishes, deploys, or selects a DHCP node.

Node removal requires `recordVersion` and `confirmName`. It soft-removes the record, disables polling, destroys the stored encrypted credential and CA material, and writes an audit record.

## Configuration inventory routes

```text
POST /api/v1/nodes/{nodeId}/observations
GET  /api/v1/clusters/{clusterId}/configuration-inventory
GET  /api/v1/clusters/{clusterId}/blocklists/presentation
GET  /api/v1/clusters/{clusterId}/allowlists/presentation
GET  /api/v1/clusters/{clusterId}/blocked-services/catalogue
GET  /api/v1/configuration-comparisons?leftSnapshotId={uuid}&rightSnapshotId={uuid}
POST /api/v1/clusters/{clusterId}/configuration-draft/import
PUT  /api/v1/clusters/{clusterId}/configuration-draft
POST /api/v1/clusters/{clusterId}/configuration-draft/validate
```

Observation performs bounded, authenticated GET requests and stores either an immutable canonical schema-v1/v2 snapshot or an immutable failed attempt with a safe error code. v0.107.52 remains schema v1; v0.107.53–v0.107.78 use schema v2, while newer unverified contracts report unknown compatibility. Inventory returns the latest attempt for each node, current capability profiles, current schema version, and the optional cluster draft. The `draft` member is omitted when no draft exists. Comparison returns `equal` plus differences grouped by section, field, and `shared_managed`, `node_specific_managed`, `observed_only`, or `unsupported` scope.

Import accepts `snapshotId`, `expectedVersion`, and `confirmed: true`. It rejects failed snapshots, cross-cluster snapshots, missing confirmation, and stale draft versions. The transaction updates the draft and writes `configuration.draft_imported`. It never publishes or deploys configuration.

Draft update accepts `expectedVersion` and a complete schema-v2 desired `document`. It saves canonical mutable intent and returns validation issues. Frozen schema-v1 drafts must be refreshed/imported before editing or publication; historical v1 revisions remain deployable and reconcilable. Validation returns the same fleet feature/listener/DHCP preflight used by publication and deployment.

The blocked-services catalogue route reads observed metadata through the controller and never mutates desired state. It returns the union of stable service IDs and names, optional group IDs, per-service supported/unsupported node IDs, per-node `available`, `stale`, `error`, or `unsupported` state, and response freshness. Upstream filtering rules and SVG icons are removed at the adapter boundary. Node URLs, credentials, and raw node errors are never returned. Metadata is cached per node version/capability signature for 15 minutes; version/capability changes force refresh, and an expired matching cache entry is exposed as stale only when a refresh fails.

The blocklist and allowlist presentation routes read `GET /control/filtering/status` through the controller and return category-specific, node-attributed filter ID, enabled state, name, rule count, last-update time, portability classification, fetch time, and safe node result. They include disabled node entries so the UI can explain disable-oriented reconciliation. Separate per-category cache keys prevent blocklist and allowlist results from crossing. A successful value is cached only as a stale fallback for a later failed read. These fields are volatile presentation metadata: they are not written to observed configuration documents, drafts, revisions, canonical hashes, verification hashes, or drift comparison.

Selected IDs remain the canonical `shared.services.blockedServiceIds` set. Save Draft preserves unknown legacy IDs. Validation, publication, and deployment preflight require every selected ID to be present in every enabled node's current catalogue and return node-attributed issues otherwise. Catalogue names, groups, counts, and freshness never participate in revision or drift hashes.

`POST /api/v1/nodes/{nodeId}/filter-refresh` accepts `{ "whitelist": false }` (or true), requires an enabled node outside maintenance, and returns the node/list type with `status: "succeeded"`. The controller records `filters.refresh_requested` before the node call and exactly one `filters.refresh_succeeded` or `filters.refresh_failed` terminal event. Fleet fan-out is performed by the UI so partial node outcomes remain explicit.

AdGuard Home's filter-refresh contract selects only blocklists versus allowlists; it does not accept URLs or filter IDs. The controller therefore does not expose a selected-row refresh operation. Both filter-list pages identify that capability boundary instead of presenting a fleet-wide refresh as a targeted action.

## Revision, deployment, and drift routes

```text
GET  /api/v1/clusters/{clusterId}/configuration-revisions
POST /api/v1/clusters/{clusterId}/configuration-revisions
GET  /api/v1/configuration-revisions/{revisionId}
GET  /api/v1/configuration-revision-comparisons?leftRevisionId={uuid}&rightRevisionId={uuid}
POST /api/v1/clusters/{clusterId}/configuration-revisions/{revisionId}/deployment-preview
POST /api/v1/clusters/{clusterId}/configuration-revisions/{revisionId}/deployments
POST /api/v1/clusters/{clusterId}/configuration-revisions/{revisionId}/rollback
GET  /api/v1/clusters/{clusterId}/deployments
GET  /api/v1/deployments/{deploymentId}
POST /api/v1/deployments/{deploymentId}/cancel
GET  /api/v1/clusters/{clusterId}/drift-events
POST /api/v1/drift-events/{driftId}/restore
POST /api/v1/drift-events/{driftId}/adopt
POST /api/v1/nodes/{nodeId}/maintenance
```

Publication requires a non-empty summary and the current draft version. Preview returns structured semantic changes from the active revision, ordered affected nodes/effective hashes, capability or listener issues, strategy/failure policy, and whether a restart is required (false for schema v1). Deployment creation returns HTTP 202 and a durable queued resource; per-node task details expose only safe errors and verification snapshot identifiers. Cancellation is a request honored at a safe node boundary. Rollback requires explicit confirmation and creates a deployment of a historical immutable revision. Drift restore creates a targeted deployment; adoption writes the observed shared state and node override into the optimistic draft but still requires publication and normal deployment.

## Audit and version routes

```text
GET /api/v1/audit-events?limit=50&offset=0
GET /api/v1/system/version
```

Audit pagination is bounded to 100 records per request. Audit metadata excludes secrets.

## DHCP operational commands

```text
POST /api/v1/nodes/{nodeId}/dhcp/reset-leases
POST /api/v1/nodes/{nodeId}/dhcp/reset-configuration
GET  /api/v1/nodes/{nodeId}/dhcp/operations?limit=10
```

Both POST routes require authentication, CSRF, an explicit UUID node path, and
a UUID `Idempotency-Key` header. Their JSON bodies contain only the fixed
controller confirmation token: `RESET_LEASES` or
`RESET_DHCP_CONFIGURATION`. The target must be enabled, in maintenance mode,
reachable through its configured trust/authentication policy, and in a cluster
without an active deployment. Configuration reset additionally requires Manual
or Alert reconciliation so a later drift mismatch cannot be silently Enforced;
lease reset changes observed-only data. No fleet DHCP reset route exists.

The controller invokes exactly one no-body AdGuard request:
`POST /control/dhcp/reset_leases` or `POST /control/dhcp/reset`. A terminal
duplicate idempotency key returns the original persistent result without a
second node call. Results contain cluster and node identity, per-node status,
stable safe errors, request ID, terminal audit reference, observation outcome,
and timestamps. They never contain node URLs, credentials, upstream bodies, or
raw upstream errors.

Successful commands immediately create a normal fresh observation. Dynamic
lease changes remain observed-only. A configuration reset does not mutate the
draft or active revision; its observed mismatch remains subject to the existing
restore/adopt drift workflow after the maintenance boundary is reviewed.

## Operational probes

```text
GET /health  # process liveness; does not require PostgreSQL
GET /ready   # PostgreSQL connectivity and mutation readiness
```

## Later contracts

Statistics and query-event contracts begin in 0.5 and 0.6.
