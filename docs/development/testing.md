# Testing Strategy

Release 0.7 operational-health validation and its remaining packaged/real-node
gates are tracked in `docs/development/release-0.7-validation.md`.

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

The 2 August 2026 deployment correction adds a DHCP idempotency contract: an exactly converged disabled configuration must not call `/control/dhcp/set_config`, but static leases must still reconcile. A mutation-rejection test requires the safe error to include method, path, and status while proving the AdGuard response body is absent. The Deployments DOM test verifies that the persisted per-node `errorMessage` is visible to the operator.

Release 0.4.1 Phase 5A adds blocklist metadata adapter, cache fallback, partial-node and controller DTO contracts; portable/credential-free URL validation; desired/active/observed table projection tests; and DOM coverage for add, edit preview, enable/disable removal confirmation, mixed node metadata, audited refresh-all partial results, Save Draft isolation, keyboard dismissal, responsive widths, and explicit light/dark themes. The existing deployment and reconciliation integration workflow continues to prove all-node read-back convergence and direct-node-change drift because Phase 5A does not change those execution paths.

Release 0.4.1 Phase 5B extends the same shared filter-list projection, table,
dialogs, and lifecycle presentation to DNS Allowlists. Adapter, inventory, and
controller tests cover both allowlist response shapes, sanitized observed-only
metadata, category-separated caches, `whitelist: true`, disable-oriented
reconciliation, and blocklist isolation. DOM tests cover migration from the
existing `whitelistUrls` array, add/edit/enable/disable/remove, observed-only
counts and timestamps, multi-node mixed application state, audited refresh-all
partial results, the explicit selected-refresh capability boundary, Save Draft
isolation, loading/empty/error/stale/partial states, keyboard dismissal,
responsive widths, and light/dark themes. The existing deployment and drift
integration workflow remains authoritative because Phase 5B does not alter
publication, deployment, verification, or drift execution.

Release 0.4.1 Phase 8A adds exact v0.107.78 DHCP-interface and active-check
adapter contracts, unavailable endpoint and timeout mapping, sanitized node
errors, controller authentication/CSRF DTO coverage, audit start/terminal
events, maintenance rejection, and aggregate none/found/multiple/partial/error
results. Domain/control-plane regressions prove static-lease MAC/IP/hostname
validation, one-active-node validation, active-lease drift exclusion, and
disable-before-enable preview ordering. Frontend model and DOM coverage verifies
interface selection and legacy preservation, active lease attribution and
freshness, non-mutating active checks, IPv4 validation, duration conversion,
static add/edit/confirmed removal, one-designation handoff, loading, empty,
error, stale, partial, desktop/mobile, light/dark, and keyboard behavior.

On 2 August 2026, Phase 8A passed the full Go and integration-compilation suite,
all 153 frontend tests across 25 files, TypeScript validation, Biome lint, and
the production Vite build. PostgreSQL integration cases remain environment
gated by `TEST_DATABASE_URL`, and a controlled real-network DHCP handoff remains
a Release 0.4 reference-node gate. Phase 8A adds no database migration.

Release 0.4.1 Phase 8B adds exact no-body DHCP reset adapter contracts;
success, rejection, timeout, unreachable, and redaction cases; authenticated
CSRF-protected node-only controller routes; maintenance/deployment safety;
durable result and requested/terminal audit transactions; per-user UUID
idempotency; observation refresh; desired-state immutability; and managed drift
classification after configuration versus lease reset. Frontend DOM coverage
includes exact node/cluster/consequence/recoverability copy, typed confirmation,
keyboard dismissal and focus behavior, duplicate-click suppression, durable
request/audit result presentation, observation reload, and no fleet selector.
The PostgreSQL case validates migration up/down/up plus command/result/audit
persistence when `TEST_DATABASE_URL` is available.

On 2 August 2026, Phase 8B passed the complete uncached Go race suite,
`go vet ./...`, controller/migration builds, all 156 frontend tests across 25
files, TypeScript validation, Biome lint, the production Vite build, and
`git diff --check`. The PostgreSQL migration/persistence case compiled but
skipped execution because `TEST_DATABASE_URL` was unset; real-node destructive
reset validation remains an explicit controlled-environment release gate.

Local validation on 30 July 2026 passed the full Go suite with race detection (`go test -race -count=1 ./...`), `go vet ./...`, the controller build, frontend TypeScript check, seven Vitest tests, Biome lint, the Vite production build, shell syntax validation, the production npm dependency audit with zero reported vulnerabilities, and `git diff --check`. The PostgreSQL cases compiled but skipped because `TEST_DATABASE_URL` was not available. Docker Compose configuration validation could not run because the Docker CLI is not installed in the validation workspace.

On 31 July 2026, the non-secure-origin settings regression check passed with the full eight-test Vitest suite, TypeScript validation, Biome lint, and the Vite production build. The test removes `crypto.randomUUID` from the runtime and verifies that editor row keys remain unique, covering rewrites, persistent clients, and DHCP static leases without weakening the recommendation to serve the controller over HTTPS. Removal of the duplicate in-page settings navigation and placement of DHCP, client, and blocked-services schedule headings inside their cards passed the same frontend gates; browser visual/accessibility smoke validation remains pending.

On 2 August 2026, the DHCP deployment correction passed the full Go suite, the uncached race suite, `go vet`, and the production controller build. Both PostgreSQL integration workflows compiled but skipped because `TEST_DATABASE_URL` was not set. The frontend passed all 68 tests across 18 files, TypeScript validation, Biome lint, and the production Vite build. Real-node replay of the originally reported disabled-DHCP deployment remains required before closing the Release 0.4 reference-node gate.

On 2 August 2026, Release 0.4.1 Phase 6 Persistent Clients presentation
passed 98 frontend tests across 21 files, TypeScript validation, Biome lint,
and the production Vite build. The complete uncached Go race suite and
`go vet ./...` also passed. The two-node PostgreSQL integration fixture now
models persistent-client add/update/delete, verifies the complete client
payload and ordered upstreams after deployment/read-back, and uses a direct
client filtering-policy change for drift creation and Enforce convergence. It
compiled in the full Go run but skipped execution because `TEST_DATABASE_URL`
was not set.

Release 0.4.1 Phase 10 adds exact canonical-route and compatibility-redirect
coverage, distinct Deployments/Drift focus, a dedicated redacted Encryption
inventory test, shell/mobile hierarchy checks, and Axe WCAG A/AA structural
checks. The production screenshot set covers explicit light and dark themes at
320, 768, 1199, 1200, and 1440 pixels plus the active mobile drawer hierarchy.
Semantic foreground/background pairs were contrast-checked separately because
jsdom cannot compute browser colour contrast.

On 2 August 2026, Phase 10 passed 191 frontend tests across 32 files,
TypeScript, Biome, the production Vite build, the complete uncached Go race
suite, `go vet ./...`, controller/migrator builds, the production dependency
audit with zero vulnerabilities, installer shell syntax, and `git diff
--check`. All four PostgreSQL integration cases compiled and skipped because
`TEST_DATABASE_URL` was unset. Docker and systemd validation were unavailable
on the macOS host. Full details are in
`release-0.4.1-phase-10-regression-report.md`.

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

`tests/integration/release_0_3_test.go` uses the same isolated-schema harness and two stateful AdGuard HTTP fixtures. It proves multi-node import followed by a shared desired-state save, immutable publication while no revision is active, two-node sequential apply/read-back convergence, active-revision selection, direct-change detection, Enforce restoration and resolution, a second revision, and deployment-based rollback. Its fixture serves the full schema-v2 observation surface and stateful persistent-client add/update/delete operations, so the same core workflow exercises 0.4 capability preflight, complete client payload convergence, ordered client upstreams, client-policy drift, and broader writer/read-back behavior. It is compiled in every Go test run and executes when `TEST_DATABASE_URL` is present.

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
9. Search combined query log (Release 0.6; not a Release 0.4.1 gate).

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

## 3 August 2026 HA responsibility separation

The information-architecture split passed 195 frontend tests across 32 files,
including exact distinct-route resolution, responsibility exclusions, enriched
Nodes presentation, semantic diff contexts, and Axe structural WCAG A/AA checks
for Configuration Control, Revisions, Deployments, and Drift. TypeScript,
Biome, the Vite production build, and the production dependency audit also
passed with zero vulnerabilities.

The complete Go suite and uncached race suite passed, including the existing
PostgreSQL integration packages through their compiled environment-gated skip
path. `go vet`, controller/migrator builds, systemd installer shell syntax, and
`git diff --check` passed. `TEST_DATABASE_URL` is unset and Docker is not
installed in this workspace, so a PostgreSQL execution run and Compose
validation were not rerun. No backend or migration changed. New authenticated
real-browser per-page screenshots and browser-history automation remain
explicit follow-on work; DOM interaction, keyboard shell, Axe, responsive
feature regressions, and the existing light/dark baseline suite passed.

## 9 August 2026 revision lifecycle presentation

Focused frontend coverage verifies `/ha/revisions` canonical routing and the
query/hash-preserving `/ha/history` redirect; navigation order and terminology;
backward-compatible expandable `DataTable` rows; returned-revision publication
handoff without deployment; deep-linked inline revision detail and nested full
configuration disclosure; invalid preview blocking; explicit deployment
confirmation and returned-deployment navigation; active deployment automatic
selection; and collapsed drift rows with exact related-resource links. Axe
coverage continues across the four separated HA lifecycle pages, including
their table semantics and dialog infrastructure.
