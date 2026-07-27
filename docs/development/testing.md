# Testing Strategy

## Unit tests

Target:

- Canonicalisation.
- Configuration merging.
- Diff generation.
- Capability validation.
- Reconciliation state transitions.
- Retry classification.
- Aggregation calculations.
- Secret redaction.

Release 0.1 unit and contract coverage includes UUID and URL invariants, password hashing, session/CSRF purpose separation, AES-GCM encryption and node binding, configuration validation, AdGuard status parsing, version compatibility, authentication/TLS failure separation, custom CA trust, health polling outcomes, and frontend health freshness/partial-failure semantics.

## Integration tests

Use real PostgreSQL.

Use real or containerised AdGuard Home versions for:

- Authentication.
- Status.
- Configuration reads.
- Configuration writes.
- Query log.
- Statistics.
- Compatibility behaviour.

`tests/integration/release_0_1_test.go` uses an isolated schema in real PostgreSQL. It verifies migration up/down/up, first setup, secure cookies, authenticated cluster creation, two-node onboarding, absence of credentials in responses, encrypted database storage, required audit actions, and controller/node process independence. `make test-local` supplies PostgreSQL and two containerised contract nodes, so this workflow cannot skip. Direct `go test` runs retain in-process node fallback and skip only when `TEST_DATABASE_URL` is intentionally absent.

## Contract tests

Keep fixtures for tested AdGuard Home API versions.

Detect unexpected payload changes.

## End-to-end tests

Critical workflows:

1. First login.
2. Add two nodes.
3. Import configuration.
4. Create revision.
5. Deploy revision.
6. Detect drift.
7. Restore drift.
8. Roll back revision.
9. Search combined query log.

The 0.1 API workflow, two-node local environment, and React production build are automated today. Browser-driven setup/login/node workflows remain a release-gate dependency; configuration through query-log workflows remain assigned to later releases.

## Failure tests

- Node timeout.
- Wrong credentials.
- One node fails during deployment.
- Controller restarts during deployment.
- Database connection loss.
- Unsupported node version.
- Verification mismatch.
- Forwarder duplicate delivery.

## Migration tests

For every released schema:

- Upgrade from previous version.
- Preserve data.
- Start application.
- Run smoke workflow.
