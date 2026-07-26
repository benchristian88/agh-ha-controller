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
