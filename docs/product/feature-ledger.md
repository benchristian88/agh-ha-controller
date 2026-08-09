# Feature Ledger

This ledger records implemented behavior separately from roadmap intent. “Implemented” does not mean the release gate has passed; external validation is listed explicitly.

## Release 0.1 foundation

| Feature | Status | Implementation and evidence | Remaining release validation |
|---|---|---|---|
| Reliable controller startup | Implemented and validated | Environment validation, PostgreSQL connection, checksum-protected migrations, worker startup, bounded HTTP server, graceful shutdown | Production-build LXC installation/functionality validation completed 29 July 2026 |
| First-run administrator | Implemented | One-time serialized setup; public URL/time/security checks; Argon2id password; setup UI and API | Browser-driven end-to-end test on packaged build |
| Local login and sessions | Implemented | Generic login failures, in-process throttling, HMAC-hashed opaque sessions, expiry/revocation, strict cookies, CSRF, logout audit | Packaged HTTPS/reverse-proxy cookie validation |
| Cluster management | Implemented | Create/list/get/update API, optimistic version, typed UI creation/selection, transactional audit | Cluster deletion deliberately excluded pending historical-lifecycle design |
| Node management | Implemented and validated | Create/list/get/update/test/disable/soft-remove, exact-name removal validation, optimistic version, typed UI | Production functionality validation completed 29 July 2026 |
| Encrypted node credentials | Implemented | AES-256-GCM envelope, node UUID binding, external key, write-only API fields, rotation/removal audit, redaction tests | Backup/restore smoke test with production secret files |
| Status/version adapter | Implemented; compatibility scope narrow | Read-only `/control/status`, Basic auth, bounded direct transport, system/custom CA trust, distinct TLS/auth/network/payload errors, `v0.107.x` contract tests | Publish results against selected real supported versions |
| Automatic node health | Implemented | Immediate and interval polling, four-probe bound, durable last-seen/poll/error/latency/version state, stale UI | Restart recovery against real nodes |
| Dashboard shell | Implemented | Responsive dark shell, cluster selector, node cards, textual states, stale and partial failure, no meaningless telemetry charts | Browser accessibility and packaged visual smoke tests |
| Audit foundation | Implemented | Append-only application API; login/setup/cluster/node/credential/manual-test/logout records; request IDs; safe metadata; audit UI | Export intentionally deferred; database permission hardening follow-up |
| Liveness and readiness | Implemented | Public process liveness and PostgreSQL-aware readiness | Reference monitoring/systemd exercise |
| CI baseline | Implemented; remote run pending | PostgreSQL service, Go format/vet/race tests/build, two-node HTTP contract workflow, frontend Biome/type/test/build, production dependency audit, Compose definition validation | Successful GitHub Actions run |

## Release 0.1.1 installation

| Feature | Status | Implementation and evidence | Remaining release validation |
|---|---|---|---|
| Docker Compose installation | Implemented and validated | Multi-stage source build, non-root/read-only controller, same-origin UI/API, PostgreSQL 17 persistence, readiness checks, protected environment inputs | Production-build install/functionality validation completed 29 July 2026 |
| Debian/systemd installation | Implemented and validated | Git-checkout build installer, local PostgreSQL provisioning, service account, generated root-only secrets, hardened unit, idempotent secret preservation | Production-build install/functionality validation completed; non-fatal ripgrep warning fixed in 0.2 |
| Initial administrator after install | Implemented | Empty database exposes setup UI; transactionally locked first administrator/session/audit creation; later attempts return conflict; regression test covers repetition | Browser-driven packaged-build test in both installation modes |

Operator validation on 29 July 2026 proved both Docker and systemd production-build installs functional. The systemd run emitted a non-fatal ripgrep warning; Release 0.2 removes that Make dependency.

## Release 0.2 configuration inventory

| Feature | Status | Implementation and evidence | Remaining release validation |
|---|---|---|---|
| Canonical schema v1 | Implemented and validated | Deterministic DNS/filtering document, ownership catalogue, ordered/set semantics, SHA-256 hash | Completed 30 July 2026 |
| Capability discovery | Implemented and validated | Per-node profiles, explicit feature flags/warnings, v0.107.52 and v0.107.61 fixtures | Completed 30 July 2026 |
| Immutable observations | Implemented and validated | Durable success/failure attempts with node attribution and safe errors | Completed 30 July 2026 |
| Structured comparison | Implemented and validated | Section, field, scope, values, semantic equality; volatile fixture regression | Completed 30 July 2026 |
| Confirmed import | Implemented and validated | Cross-cluster protection, explicit confirmation, optimistic draft, transactional audit; no revision/deployment | Completed 30 July 2026 |
| Configuration UI | Implemented and validated | Loading/error/empty states, refresh, warnings, comparison, equality, import boundary | Completed 30 July 2026 |
| systemd ripgrep warning | Fixed and validated | Make source discovery uses portable `find`; installer no longer indirectly needs `rg` | Completed 30 July 2026 |
| Empty-draft configuration page | Fixed and validated in 0.2.1 | API omits an absent draft; UI normalises both omitted and legacy `null` values before rendering | Completed 30 July 2026 |
| Atomic systemd runtime upgrade | Fixed and validated in 0.2.2 | Installer explicitly restarts and verifies the unit after replacing the binary/UI, preventing mixed frontend/API versions | Completed 30 July 2026 |

Operator validation completed on 30 July 2026 for Releases 0.2, 0.2.1, and 0.2.2, including configuration inventory/import and the corrected systemd upgrade behavior. These patch lines are complete; their historical rows are retained above.

## Release 0.3 authoritative configuration

| Feature | Status | Implementation and evidence | Remaining release validation |
|---|---|---|---|
| Authoritative desired draft | Implemented and validated | Separate schema-v1 `DesiredDocument`, shared policy plus UUID-keyed node overrides, optimistic save/validation, migrated 0.2 imports; PostgreSQL workflow covers multi-node re-import followed by shared-state save | Completed 30 July 2026 |
| Listener identity inventory | Implemented and validated; 0.3.0 regression fixed | `/control/status` `dns_addresses`/`dns_port` mapping, invalid-observation failure, incomplete legacy-import rejection, supported-version contract fixtures, named UI recovery guidance | Completed 30 July 2026 |
| Immutable revisions | Implemented and validated | Numbered per-cluster revisions, canonical hashes, summaries, base revision, list/detail/semantic comparison API and UI | Completed 30 July 2026 |
| Safe sequential deployment | Implemented and validated | Durable deployment/tasks, full-target preflight, stop-on-first-failure, safe cancellation, restart interruption, per-node safe result | Completed 30 July 2026 |
| AdGuard configuration writer | Implemented and validated; schema-v1 narrow | Supported DNS/filtering HTTP endpoints, Basic auth/TLS reuse, blocklist reconciliation, whitelist preservation, safe error mapping; loopback contract passes | Completed 30 July 2026 |
| Read-back convergence | Implemented and validated | Fresh observation after each write, semantic verification snapshot, applied revision/hash, active revision only after full success | Completed 30 July 2026 |
| Rollback | Implemented and validated | Explicit confirmed deployment of a historical immutable revision with linkage and audit | Completed 30 July 2026 |
| Drift lifecycle | Implemented and validated | Periodic fresh observation, fingerprint deduplication, structured values, detection/resolution audit, node convergence state | Completed 30 July 2026 |
| Reconciliation policies | Implemented and validated | Manual default, Alert no-mutation state, Enforce targeted durable restore with later retry after fresh observation | Completed 30 July 2026 |
| Maintenance mode | Implemented and validated | Optimistic audited node state, mutation exclusion, visible convergence/drift maintenance state, UI action | Completed 30 July 2026 |
| Release 0.3 UI/API | Implemented and validated | Draft editor, validation, revisions, deploy/rollback, deployment timeline/cancel, drift restore/adopt/maintenance, policy control | Completed 30 July 2026 |

The operator completed Release 0.3 functional, PostgreSQL, Docker, and systemd validation on 30 July 2026. Historical pending evidence is retained in the roadmap; the release and its patch lines are complete.

## Release 0.4 broader AdGuard Home coverage

| Feature | Status | Implementation and evidence | Remaining release validation |
|---|---|---|---|
| Canonical schema v2 | Implemented; automated checks pass | Broader shared policy, node DHCP overrides, redacted observations, deterministic canonicalisation/diff/validation, frozen-v1 projection | Upgrade/reference-node workflow |
| Compatibility and capabilities | Implemented | v0.107.52 legacy v1; explicit v0.107.53–v0.107.78 v2 range; patch-level cache/timeout/filter/rewrite/ignore flags plus Ecosia/DHCP fleet preflight | Real supported-version matrix |
| DNS, filtering, and refresh | Implemented | Full supported DNS payload; separate blocklist/allowlist reconciliation and dedicated routes using one shared desired/observed table/dialog composition; node metadata remains outside desired hashes; disable-oriented removal wording; audited per-node refresh with fleet partial results | Real list refresh/write-back |
| Persistent clients and rewrites | Implemented | Set reconciliation; complete client safety/blocked-service schedule/upstream-cache preservation; searchable client and rewrite tables with focused dialogs; rewrite contract validation/type inference, capability warning, confirmed draft-only delete, and row convergence state; two-node fixture carries rewrites through verified deployment and direct-change drift restoration | Browser and real-node workflow; PostgreSQL-backed fixture requires `TEST_DATABASE_URL` |
| Services and safety | Implemented | Blocked IDs/schedules, Safe Browsing, parental control, Safe Search engine policy | Real-node workflow |
| Query-log/statistics policy | Implemented | Node-local enablement, retention, ignore/anonymization policy via supported PUT APIs | Real-node workflow; ingestion deliberately later |
| TLS modelling | Implemented; mutation deferred | Public status/certificate metadata only; secret fields have no domain/API representation | Redaction scan against a real node |
| DHCP management | Implemented; Phase 8B destructive operations complete | Inventory, dynamic observed leases, node-specific config/static leases, single-active validation, disable-before-enable ordering, idempotent reconciliation, controller-mediated interface discovery, audited non-mutating active-DHCP checks, and separate maintenance-guarded reset-leases/reset-configuration commands with durable per-node results, audit references, idempotency, and post-command observation | Controlled-network handoff/reset exercise and packaged retry of the reported disabled-node case |
| Release 0.4 UI | Superseded by Release 0.4.1 presentation | The schema-v2 feature behavior remains implemented, but the sidebar-era presentation and broad route descriptions are historical | See Release 0.4.1 UI alignment below |
| Migration and history compatibility | Implemented | `000004` permits v1/v2 without rewriting immutable data; historical execution projects observations; PostgreSQL integration tests compile | PostgreSQL 0.3-to-0.4 upgrade run (`TEST_DATABASE_URL` was unavailable locally) |
| Release 0.4 installation and functional validation | Validated | Operator completed functional validation plus Docker and native/systemd installation validation on 3 August 2026 | Complete; historical local-environment limitations remain recorded in their original reports |

Local Go race/vet/build and frontend type/test/lint/build checks passed on 30 July 2026; the production dependency audit reported zero vulnerabilities. Exact contemporary limitations remain recorded in `docs/development/testing.md`. Subsequent operator validation on 3 August 2026 completed Release 0.4 functional, Docker-installation, and native/systemd-installation outcomes without rewriting that historical evidence.

## Release 0.4.1 UI alignment and hardening

| Feature | Status | Implementation and evidence | Remaining release validation |
|---|---|---|---|
| Canonical routing and compatibility | Implemented and locally validated | Exact canonical route table, preserved legacy redirects, trailing-slash normalization, explicit planned states, Not Found, active parent state, and route-focused Deployments/Drift | Packaged browser smoke |
| Navigation and global context | Implemented and locally validated | Horizontal desktop groups, matching mobile drawer, cluster/scope/revision/health/deployment context, unavailable state, keyboard coverage, and 320–1440px captures | Packaged authenticated browser workflow |
| Operator-facing feature presentation | Implemented | Configuration Control plus Blocked Services, subscriptions, clients, rewrites, DHCP, General, DNS, Custom Rules, and dedicated redacted Encryption pages use the shared primitives and retain Save Draft/Publish/Deploy separation | Supported real-node workflow |
| Accessibility and visual baselines | Locally validated | Axe WCAG A/AA structural checks, keyboard/dialog focus regressions, contrast-checked semantic tokens, light/dark screenshots at 320, 768, 1199, 1200, and 1440px, plus mobile drawer | External assistive-technology/browser audit |
| Regression and cleanup | Locally validated | 191 frontend tests, full uncached Go race suite, vet, native production build, zero production dependency vulnerabilities, no browser `/control/` calls; obsolete broad editor removed | PostgreSQL-backed workflow requires `TEST_DATABASE_URL` |
| Release 0.4.1 packaging and upgrade | Partially validated | All source-build defaults agree on 0.4.1; controller/migrator/web build and installer syntax pass; append-only migrations unchanged | Docker/systemd clean install, 0.4 upgrade, restart persistence, and live log scan unavailable on this host |
| Distinct Nodes page | Implemented | Infrastructure-only cluster summary and node table expose health, compatibility, capability profile, latency, observation freshness, applied revision, drift, maintenance, and node actions | Node-specific observed listener/TLS/DHCP detail remains on its canonical feature pages |
| Configuration Control responsibility | Implemented | Forward-looking schema-v2 draft/change summary, validation, immutable publication, and advanced observation/import/adoption; routine editing remains under Settings/Filters | Draft read model has no displayable updater name |
| Distinct Deployments page | Implemented | Active execution, history, derived progress/current task, ordered per-node task/error/verification detail, request ID, and safe cancellation | Dedicated retry endpoint and nested detail routes remain deferred |
| Distinct Drift page | Implemented | Current convergence summary, structured desired-versus-observed incidents, restore/adopt/maintenance, related-resource links, and separated cluster policy | Severity/source/acknowledge are not persisted by the current drift model |
| Distinct Revisions page | Implemented | Canonical `/ha/revisions`, query-backed adjacent detail/snapshot, revision comparison, deployment joins, accessible preview/confirmation, and historical-revision rollback deployment; `/ha/history` redirects compatibly | Friendly actor-name resolution is not exposed by the current read model |
| Comparison and adoption ownership | Implemented | Shared structured-diff presentation supports snapshot/revision/drift contexts; adoption enters Configuration Control and mutates only the optimistic draft | Draft-versus-historical comparison remains follow-on work |

The complete Phase 10 evidence, route table, deletion inventory, and known
issues are in
`docs/development/release-0.4.1-phase-10-regression-report.md`.

## Release 0.5 statistics aggregation — complete and validated

| Feature | Status | Implementation and evidence | Remaining release validation |
|---|---|---|---|
| Exact-range collection | Complete and validated | Immediate/configurable interval worker, retention-aware eligible 24h/7d/30d `recent` reads, four-node concurrency, request timeouts, maintenance and v0.107.72–v0.107.78 capability gates, safe durable attempts | Operator evidence reproduced the 24h-retention boundary; regression coverage added |
| Durable telemetry model | Complete and validated | Append-only `000009` separates poll evidence, immutable normalized snapshots, and overlap-safe hourly/daily node buckets; 32/400-day cleanup | Operator-confirmed working |
| Correct aggregation | Complete and validated | Additive sums, aggregate percentages, query-weighted processing time, response-weighted upstream latency, stable normalization/sort, chronological series, explicit freshness/coverage | Operator-confirmed working |
| Statistics API and UI | Complete and validated | Authenticated presentation-ready cluster/node API; global scope, fixed ranges, summary metrics, accessible SVG chart, ranked panels, node coverage, and compact dashboard summary | Operator-confirmed working |
| Security and privacy boundary | Complete and validated | Direct bounded controller reads; no DNS proxy, query-log dependency, raw response persistence, secret/URL logging, or browser-to-node calls | Operator-confirmed working |

Custom ranges and Query Log ingestion remain deliberately deferred. Detailed
behavior and operator recovery are documented in
`docs/backend/statistics-aggregation.md` and `docs/operations/runbook.md`.

## Release 0.6 combined Query Log — complete and validated

| Feature | Status | Implementation and evidence | Remaining release validation |
|---|---|---|---|
| Central ingestion | Complete and validated | Immediate/configurable worker, four-node bound, source `older_than` paging, durable checkpoints/attempts, overlap, safe errors, reset/retention/cursor gap evidence | Operator-confirmed working |
| Identity and storage | Complete and validated | Normalized cluster/node events, SHA-256 stable-field fingerprint plus occurrence ordinal, node-scoped uniqueness, batch insert, bounded seven-day default cleanup, no credentials/raw payload | Operator-confirmed working |
| Query API | Complete and validated | Authenticated cluster/node scope, parameterized domain/client search, status/type/client filters, bounded timestamp/UUID keyset cursor, detail, explicit coverage/freshness | Operator-confirmed working |
| Query Log UI | Complete and validated | Canonical route, mandatory Node column, responsive table, debounced search, filters, previous/next cursor stack, conservative refresh/new-record notice, structured detail, partial/disabled/gap states | Operator-confirmed working |
| Contextual configuration | Complete and validated | Allow/block proposals enter Custom Filter Rules; rewrite opens validated prefilled dialog; client uses safe search; all remain mutable-draft-only | Operator-confirmed working |
| Privacy boundary | Complete and validated | Node anonymisation preserved, same-origin authenticated controller reads, bounded normalization, no routine event logging/support bundle inclusion, independent collection and retention | Fine-grained RBAC remains future scope before multiple roles |

API polling cannot recover events already removed by node-local retention and
cannot derive a perfect stable identity for completely indistinguishable
records because AdGuard Home supplies no event ID. These limitations are
represented conservatively. ADR-0029 makes any higher-fidelity forwarder
conditional on measured need rather than assigning it a release. See
`docs/backend/query-ingestion.md`, ADR-0015, and the operations runbook.

## Release 0.7 operational hardening and observability

| Feature | Status | Implementation and evidence | Remaining release validation |
|---|---|---|---|
| Operational health model/API | Implemented; automated checks pass | Shared eight-state model; authenticated cluster-scoped `/operational-status`; overall aggregation; safe bounded payload | Packaged PostgreSQL outage and multi-cluster browser exercise |
| Operational Status UI | Implemented; frontend checks pass | Administration route, core services, observation/Statistics/Query Log tables, known gaps, workers, storage/retention, loading/error/degraded states | Packaged mobile/desktop light/dark browser captures |
| Collector and observation health | Implemented | Existing 0.5/0.6 freshness reused; node reachability separated from immutable full observation; attempts/checkpoints remain restart source of truth | Controlled stale/failure/recovery run against two nodes |
| Worker health and backoff | Implemented; unit checks pass | Process-local bounded tracker, running/last success/failure/streak/next run/duration, reset on recovery; deployment/command exponential backoff capped at 30s | Shutdown and repeated real database failure exercise |
| Database/storage/retention | Implemented | PostgreSQL ping/schema/pool/size, relation estimates, retained bounds, worker cleanup state; Statistics deletes bounded to 10,000 per dataset/pass | Large-table query-plan and retention exercise |
| Liveness/readiness/metrics | Implemented | Public minimal `/health`; database-aware `/ready`; opt-in minimum-32-character bearer-protected Prometheus worker counters/gauges with bounded labels | Deployment-network access-policy smoke |
| Dashboard integration | Implemented | Compact controller, Statistics, and Query Log state linking to full status | Packaged responsive browser smoke |
| Agentless-by-default | Accepted | ADR-0029 keeps native API ingestion standard and moves the forwarder to evidence-triggered future scope | Revisit only after measured trigger |

Release 0.7 does not add an agent, local spool, machine credentials, notification
platform, controller HA, node upgrade automation, or DNS traffic handling.

## Deliberately deferred

- Field-level drift ignore rules, selectable partial-deployment recovery, parallel/rolling strategies, scheduled maintenance windows, and intra-mutation automatic retries: later operational work.
- TLS certificate/key mutation: deferred pending controller-managed secret references; 0.4 provides redacted modelling only.
- Custom statistics ranges and query-derived analytics/rollups: later work; fixed-range statistics are implemented in 0.5, API-polled query ingestion in 0.6, and node-local telemetry policy remains managed configuration.
- Additional local-user management, password change/recovery, durable or distributed login throttling, OIDC, and RBAC: follow-on security scope.
- Automated backup/restore tooling and an audit export: later operational releases; the supported recovery path remains manual.
- Proxmox community installer, signed/prebuilt artifacts, and automated upgrade/rollback remain later release work.

## Known limitations

- Release 0.1 supports one initial administrator and has no account-management screen.
- Process worker state is in-memory and becomes unknown after restart; durable
  collector attempts, checkpoints, observations, deployments, and drift remain
  the restart source of truth.
- The built React directory is installed alongside the Go binary rather than embedded in it.
- `insecure_http` exists for explicit homelab compatibility and exposes node credentials to that management network; it is never selected implicitly.
- Repeatable automated packaged-host backup/restore and live DNS-outage evidence remain follow-on improvements after the operator accepted the 0.1/0.1.1 production validation.
