# Backend Design

## Executables

### controller

Initial all-in-one process:

- HTTP server.
- API.
- Frontend static assets.
- Scheduler.
- Background workers.

It may later be split into API and worker services.

### forwarder

Optional later node-side process for query-log ingestion.

## Package boundaries

- `auth`: users, passwords, sessions, permissions.
- `domain`: core entities and value objects.
- `database`: repositories and transactions.
- `adguard`: external AdGuard Home adapter.
- `config`: controller runtime configuration.
- `reconciliation`: desired versus observed state.
- `telemetry`: statistics and query events.
- `jobs`: scheduling and job execution.
- `api`: HTTP transport and DTO mapping.

### Release 0.1 concrete packages

- `internal/domain`: UUIDs, stable errors, users, sessions, clusters, nodes, audit types, validation, and `ManagementService` orchestration.
- `internal/database`: `pgx` pool, embedded migration runner, PostgreSQL repositories, transactions, and atomic protected-change/audit writes.
- `internal/auth`: Argon2id password hashing, HMAC session/CSRF tokens, login throttling, versioned credential encryption, and authentication service.
- `internal/adguard`: bounded, direct status/version adapter with explicit TLS policy and stable failure mapping.
- `internal/jobs`: health polling and session cleanup.
- `internal/api`: standard-library route registration, DTO decoding, authentication/CSRF middleware, security headers, error mapping, request IDs, and frontend serving.
- `internal/config`: environment-only runtime configuration and secret validation.
- `internal/version`: build-injected controller version metadata.

`cmd/controller` wires these boundaries and owns graceful process lifecycle. `cmd/migrate` is a thin explicit migration entry point.

## Domain services

Initial services:

- UserService
- SessionService
- ClusterService
- NodeService
- CapabilityService
- ObservationService
- RevisionService
- DeploymentService
- ReconciliationService
- StatisticsService
- QueryLogService
- AuditService

## Error model

Use typed domain errors:

- ValidationError
- NotFoundError
- ConflictError
- AuthenticationError
- AuthorisationError
- NodeUnavailableError
- NodeAuthenticationError
- CapabilityError
- ApplyError
- VerificationError

Transport layers map these to stable API responses.

## Transactions

Use transactions for:

- Creating a revision and its configuration payload.
- Activating a revision.
- Creating a deployment and node tasks.
- Recording an adopted drift change.
- Rotating encrypted credentials.
- Creating an audit event with a protected state change.

Release 0.1 uses a transaction for initial administrator creation, successful login/session creation, logout revocation, cluster creation/update, node creation/update/removal, and manual node connection-test results. A protected change fails if its audit event cannot be written.

## Release 0.1 failure behaviour

- Startup fails before serving when required configuration, secrets, PostgreSQL connectivity, or migrations are invalid.
- `/health` remains a process-only liveness check; `/ready` fails when PostgreSQL is unavailable.
- State-changing API work fails closed when it cannot be stored and audited.
- Node transport, TLS, authentication, and payload failures have different stable error codes.
- Poll failures retain the prior successful `last_seen_at`, set `last_polled_at`, and expose a safe error code.
- Controller shutdown cancels workers and gracefully drains HTTP; it performs no node mutation.
