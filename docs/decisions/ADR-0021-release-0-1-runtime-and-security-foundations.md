# ADR-0021: Define Release 0.1 runtime and security foundations

**Status:** Accepted

**Date:** 27 July 2026

**Decision owners:** Project owner and maintainers
**Related release:** 0.1

## Context

The product design leaves several implementation choices open before Release 0.1: HTTP routing, PostgreSQL access, migration execution, password and session protection, credential encryption, node TLS trust, health-job persistence, and frontend delivery. The release needs a small, auditable foundation without creating infrastructure that competes with later desired-state and deployment work.

## Decision

Release 0.1 will use:

- Go's standard `net/http` router and middleware model;
- `pgx` for PostgreSQL access without an ORM;
- ordered SQL migrations embedded from the repository-level `migrations` package and tracked in `schema_migrations`;
- Argon2id password hashes with parameters stored in the encoded hash;
- random opaque browser session and CSRF tokens, stored only as HMAC-SHA-256 hashes using the runtime session secret;
- versioned AES-256-GCM envelopes for AdGuard Home credentials, using a runtime key that is never stored in PostgreSQL;
- system trust, an optional node-specific custom CA, or explicit plaintext HTTP for node transport; TLS certificate verification cannot be disabled;
- immediate and interval-based health polling in the controller process, because health checks are idempotent and their durable result is stored on the node record;
- a React/Vite frontend served by the controller from a configured build directory on the same origin as the API.

Release 0.1 supports the AdGuard Home `/control/status` contract for version family `v0.107.x` and later compatible status payloads. Configuration capability discovery remains Release 0.2 scope.

## Consequences

- The controller remains one service and one failure domain for the initial homelab release.
- Domain and adapter boundaries do not depend on a router, ORM, or raw AdGuard Home response type.
- Migration and audit behavior can be tested directly against PostgreSQL.
- Stolen database contents do not directly reveal session tokens or node passwords.
- Loss of runtime secrets invalidates sessions or makes node credentials unrecoverable, so backups must include those secrets separately.
- Plain HTTP node connections are possible only through an explicit, visible policy and are discouraged.
- Health polling resumes safely after restart without a durable job queue; later long-running mutations still require persisted jobs.
- Production packaging must install both the controller binary and the built frontend directory.

## Alternatives considered

- A third-party HTTP router and ORM.
- Database-backed plaintext or reversibly encoded credentials.
- Signed session payloads containing user state.
- Silently skipping TLS certificate verification.
- A durable queue for idempotent health checks.
- A separately hosted frontend or checked-in generated frontend assets.

## Review triggers

Review this decision when health work becomes stateful, API traffic requires multiple controller processes, key rotation is implemented, the supported AdGuard Home version range changes, or packaging requires a single embedded binary.
