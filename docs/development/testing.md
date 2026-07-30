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

Release 0.4 adds frozen schema-v1 marshal/projection tests, schema-v2 validation and DHCP single-active checks, v0.107.52/v0.107.53/v0.107.78 compatibility-boundary tests, patch-level cache/timeout/filter/rewrite/ignore capability contracts, broader inventory redaction and HTTP method contracts, managed-only drift comparison, audited filter refresh, and expanded two-node fixture endpoints. Frontend checks cover the typed schema-v2 contract; browser-driven settings interaction remains a release validation item.

Local validation on 30 July 2026 passed the full Go suite with race detection (`go test -race -count=1 ./...`), `go vet ./...`, the controller build, frontend TypeScript check, seven Vitest tests, Biome lint, the Vite production build, shell syntax validation, the production npm dependency audit with zero reported vulnerabilities, and `git diff --check`. The PostgreSQL cases compiled but skipped because `TEST_DATABASE_URL` was not available. Docker Compose configuration validation could not run because the Docker CLI is not installed in the validation workspace.

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

`tests/integration/release_0_3_test.go` uses the same isolated-schema harness and two stateful AdGuard HTTP fixtures. It proves multi-node import followed by a shared desired-state save, immutable publication while no revision is active, two-node sequential apply/read-back convergence, active-revision selection, direct-change detection, Enforce restoration and resolution, a second revision, and deployment-based rollback. Its fixture now serves the full schema-v2 observation surface, so the same core workflow also exercises 0.4 capability preflight and broader writer/read-back behavior. It is compiled in every Go test run and executes when `TEST_DATABASE_URL` is present.

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

The 0.1 API workflow, authoritative two-node integration workflow, and React production build are automated. Release 0.3 packaged Docker/systemd and functional validation completed on 30 July 2026. Browser-driven 0.4 settings and a reference-node schema-v2/DHCP handoff exercise remain release-gate dependencies; central statistics and query-log ingestion workflows remain assigned to later releases.

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
