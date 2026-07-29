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

Release 0.2 adds canonical hash/equality, ordered-field differences, and raw v0.107.52/v0.107.61 status, DNS, and filtering fixtures whose volatile counters, generated IDs, labels, counts, and timestamps must not create differences. The fixtures preserve the upstream API boundary: listener identity is present only in `/control/status`, while shared DNS parameters are present in `/control/dns_info`. Missing listener identity is a failed observation and cannot be imported.

Release 0.3 adds desired/effective document validation, all-target-before-mutation executor tests, sequential apply/read-back activation tests, and an AdGuard writer contract test that verifies supported endpoints and protects whitelist filters.

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

`tests/integration/release_0_1_test.go` uses an isolated schema in real PostgreSQL. It verifies migration up/down/up, one-time first-admin setup, repeat-setup rejection, secure cookies, authenticated cluster creation, two-node onboarding, absence of credentials in responses, encrypted database storage, required audit actions, and controller/node process independence. `make test-integration` requires `TEST_DATABASE_URL`; ordinary `go test` runs skip this package only when that variable is absent.

`tests/integration/release_0_3_test.go` uses the same isolated-schema harness and two stateful AdGuard HTTP fixtures. It proves immutable publication, two-node sequential apply/read-back convergence, active-revision selection, direct-change detection, Enforce restoration and resolution, a second revision, and deployment-based rollback. It is compiled in every Go test run and executes when `TEST_DATABASE_URL` is present.

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

The 0.1 API workflow, Release 0.3 authoritative integration workflow, and React production build are automated. Browser-driven setup/login/node/deployment workflows and packaged 0.3 installation smoke tests remain release-gate dependencies; statistics and query-log workflows remain assigned to later releases.

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
