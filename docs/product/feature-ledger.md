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
| DNS, filtering, and refresh | Implemented | Full supported DNS payload; blocklist/allowlist reconciliation; custom rules; dedicated blocklist desired/observed table with node metadata and disable-oriented removal wording; audited per-node refresh with fleet partial results | Real list refresh/write-back |
| Persistent clients and rewrites | Implemented | Set reconciliation, complete client safety/blocked-service schedule/upstream-cache preservation, typed UI, non-secure-origin row-key regression coverage | Browser and real-node workflow |
| Services and safety | Implemented | Blocked IDs/schedules, Safe Browsing, parental control, Safe Search engine policy | Real-node workflow |
| Query-log/statistics policy | Implemented | Node-local enablement, retention, ignore/anonymization policy via supported PUT APIs | Real-node workflow; ingestion deliberately later |
| TLS modelling | Implemented; mutation deferred | Public status/certificate metadata only; secret fields have no domain/API representation | Redaction scan against a real node |
| DHCP management | Implemented; redundant-write defect fixed | Inventory, dynamic observed leases, node-specific config/static leases, single-active validation, disable-before-enable ordering, and idempotent configuration reconciliation that still manages static leases | Controlled-network handoff exercise and packaged retry of the reported disabled-node case |
| Release 0.4 UI | Implemented | Seven nested settings routes using one primary navigation, responsive accessible forms with in-card client/schedule/node headings, schema gate, partial refresh, and TLS/DHCP safeguards; rewrites, clients, and static leases avoid secure-context-only UI identifiers; deployment tasks show persisted safe operation/status failure detail | Browser accessibility/visual smoke |
| Migration and history compatibility | Implemented | `000004` permits v1/v2 without rewriting immutable data; historical execution projects observations; PostgreSQL integration tests compile | PostgreSQL 0.3-to-0.4 upgrade run (`TEST_DATABASE_URL` was unavailable locally) |

Local Go race/vet/build and frontend type/test/lint/build checks passed on 30 July 2026; the production dependency audit reported zero vulnerabilities. Exact results and unavailable Docker/PostgreSQL environment gates are recorded in `docs/development/testing.md`. Release 0.4 remains implemented rather than complete until the remaining reference environment gates above pass.

## Deliberately deferred

- Field-level drift ignore rules, selectable partial-deployment recovery, parallel/rolling strategies, scheduled maintenance windows, and intra-mutation automatic retries: later operational work.
- TLS certificate/key mutation: deferred pending controller-managed secret references; 0.4 provides redacted modelling only.
- Statistics and query-log ingestion: Releases 0.5 and 0.6; their node-local settings are managed in 0.4.
- Additional local-user management, password change/recovery, durable or distributed login throttling, OIDC, and RBAC: follow-on security scope.
- Automated backup/restore tooling and an audit export: later operational releases; the supported recovery path remains manual.
- Proxmox community installer, signed/prebuilt artifacts, and automated upgrade/rollback remain later release work.

## Known limitations

- Release 0.1 supports one initial administrator and has no account-management screen.
- Health work is in-process and intentionally not represented as durable jobs; only its latest result is durable.
- The built React directory is installed alongside the Go binary rather than embedded in it.
- `insecure_http` exists for explicit homelab compatibility and exposes node credentials to that management network; it is never selected implicitly.
- Repeatable automated packaged-host backup/restore and live DNS-outage evidence remain follow-on improvements after the operator accepted the 0.1/0.1.1 production validation.
