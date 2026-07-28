# Controller API

## Release 0.2 contract

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

Before saving an enabled node, the controller verifies status, authentication, TLS policy, version, and DNS running state. It never changes AdGuard Home configuration in 0.2.

Node responses include identity, URL, trust policy, enabled state, health, compatibility, version, polling timestamps, latency, safe error code, and `recordVersion`. They never include credentials, ciphertext, nonces, CA contents, or authentication headers. The cluster node-list envelope also includes `refreshedAt` and `staleAfterSeconds`; the latter is three configured health intervals so the UI freshness state follows runtime polling configuration.

The manual `test-connection` action atomically stores its safe observed result and an audit event with a success or failure outcome. Background interval polls update health without generating high-volume audit records.

Node removal requires `recordVersion` and `confirmName`. It soft-removes the record, disables polling, destroys the stored encrypted credential and CA material, and writes an audit record.

## Configuration inventory routes

```text
POST /api/v1/nodes/{nodeId}/observations
GET  /api/v1/clusters/{clusterId}/configuration-inventory
GET  /api/v1/configuration-comparisons?leftSnapshotId={uuid}&rightSnapshotId={uuid}
POST /api/v1/clusters/{clusterId}/configuration-draft/import
```

Observation performs bounded, authenticated GET requests only and stores either an immutable canonical schema-v1 snapshot or an immutable failed attempt with a safe error code. Inventory returns the latest attempt for each node, current capability profiles, and the optional cluster draft. The `draft` member is omitted when no draft exists; 0.2.1 also tolerates the `draft: null` value returned by the original 0.2.0 handler. Comparison returns `equal` plus differences grouped by section, field, and `shared_managed`, `node_specific_managed`, `observed_only`, or `unsupported` scope.

Import accepts `snapshotId`, `expectedVersion`, and `confirmed: true`. It rejects failed snapshots, cross-cluster snapshots, missing confirmation, and stale draft versions. The transaction updates the draft and writes `configuration.draft_imported`. It never publishes or deploys configuration.

## Audit and version routes

```text
GET /api/v1/audit-events?limit=50&offset=0
GET /api/v1/system/version
```

Audit pagination is bounded to 100 records per request. Audit metadata excludes secrets.

## Operational probes

```text
GET /health  # process liveness; does not require PostgreSQL
GET /ready   # PostgreSQL connectivity and mutation readiness
```

## Later contracts

Published immutable revisions, deployments, rollback, and drift begin in 0.3. Statistics and query-event contracts begin in 0.5 and 0.6.
