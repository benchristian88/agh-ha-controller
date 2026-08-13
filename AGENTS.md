# AGENTS.md

This file defines the working rules for AI coding agents and human contributors building Atlas DNS Controller.

## Product objective

Build a reliable management plane for multiple AdGuard Home nodes.

The controller must provide one authoritative configuration, safe deployment, drift detection, revision history, aggregated observability, and a coherent dark-mode user interface without becoming part of the live DNS request path.

## Non-negotiable architecture rules

1. The controller must never proxy normal DNS queries.
2. AdGuard Home nodes must continue serving DNS if the controller is unavailable.
3. The controller is the source of truth for managed configuration.
4. Every configuration change must create an immutable revision.
5. Every deployment must record per-node results.
6. Direct node changes must be detected as drift.
7. Node-specific values must not be forced into the shared configuration model.
8. Capability differences between AdGuard Home versions must be explicit.
9. Secrets must never be written to logs.
10. Destructive or irreversible operations require explicit validation and audit records.

## Development behaviour

Before making a material change:

1. Identify the user or operator outcome.
2. Confirm the relevant architecture boundary.
3. Identify affected domain entities and database records.
4. Define failure behaviour.
5. Define tests.
6. Update documentation when behaviour changes.

Do not make broad refactors unless they are required by the requested feature.

Do not silently change naming, endpoint contracts, database semantics, or deployment behaviour.

## Preferred implementation order

For each feature:

1. Domain model.
2. Database migration.
3. Repository/storage layer.
4. Service layer.
5. API contract.
6. Frontend.
7. Integration tests.
8. Documentation.

## Go conventions

- Use Go modules.
- Keep `cmd/` thin.
- Business logic belongs under `internal/`.
- Prefer explicit interfaces at infrastructure boundaries.
- Avoid generic utility packages.
- Use context propagation for request-scoped and job-scoped work.
- Wrap errors with useful context.
- Use structured logging.
- Validate external input at API boundaries.
- Use transactions for multi-table state changes.
- Make background jobs idempotent where possible.

## Frontend conventions

- React with TypeScript.
- Organise by feature, not by generic component type alone.
- Keep API access in a typed client layer.
- Model loading, empty, error, stale, and partial-success states.
- Use accessible native controls.
- Follow the AdGuard Home-inspired dark theme defined in the frontend design documents.
- Do not copy AdGuard Home source code or proprietary assets.
- Preserve node attribution throughout statistics and query-log views.

## Database rules

- PostgreSQL is the initial system of record.
- Migrations are append-only after release.
- Use UUIDs for externally exposed identifiers.
- Use UTC timestamps.
- Store immutable revisions separately from mutable drafts.
- Keep desired configuration, observed configuration, and deployment results distinct.
- Do not store raw passwords or plaintext node credentials.
- Design retention and aggregation before adding high-volume data.

## API rules

- API paths are versioned under `/api/v1`.
- Return stable machine-readable error codes.
- Use request IDs.
- Use optimistic concurrency for mutable resources.
- Avoid exposing internal database identifiers or schema details.
- Long-running deployments should return a job or deployment resource.

## Testing expectations

Every feature requires the appropriate combination of:

- Unit tests for domain logic.
- Integration tests for PostgreSQL and AdGuard Home API interactions.
- Contract tests for API payloads.
- End-to-end tests for critical operator workflows.
- Failure-path tests.
- Upgrade and migration tests for released schemas.

## Security expectations

- Treat AdGuard Home credentials as secrets.
- Encrypt stored credentials.
- Use secure, HTTP-only cookies for browser sessions.
- Apply CSRF protection where relevant.
- Rate-limit authentication endpoints.
- Audit login, configuration, deployment, rollback, credential, and node-management events.
- Never expose secrets through frontend state, API responses, diagnostics, or exports.

## Definition of done

A change is complete when:

- It meets the documented operator outcome.
- Failure behaviour is defined.
- Tests pass.
- Security implications are addressed.
- API and database changes are documented.
- Relevant Markdown documentation is updated.
- No placeholder behaviour remains on the execution path.
