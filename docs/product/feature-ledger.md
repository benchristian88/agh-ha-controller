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
| Canonical schema v1 | Implemented | Deterministic DNS/filtering document, ownership catalogue, ordered/set semantics, SHA-256 hash | Real-node semantic comparison |
| Capability discovery | Implemented | Per-node profiles, explicit feature flags/warnings, v0.107.52 and v0.107.61 fixtures | Confirm release-LXC node versions |
| Immutable observations | Implemented | Durable success/failure attempts with node attribution and safe errors | Production upgrade and refresh smoke test |
| Structured comparison | Implemented | Section, field, scope, values, semantic equality; volatile fixture regression | Intentional real-node difference exercise |
| Confirmed import | Implemented | Cross-cluster protection, explicit confirmation, optimistic draft, transactional audit; no revision/deployment | Production UI import smoke test |
| Configuration UI | Implemented | Loading/error/empty states, refresh, warnings, comparison, equality, import boundary | Packaged browser/accessibility check |
| systemd ripgrep warning | Fixed | Make source discovery uses portable `find`; installer no longer indirectly needs `rg` | Clean systemd upgrade rerun |

## Deliberately deferred

- Drafts, immutable revisions, deployment, rollback, drift, reconciliation, and maintenance mode: Release 0.3.
- Statistics and query logs: Releases 0.5 and 0.6.
- Additional local-user management, password change/recovery, durable or distributed login throttling, OIDC, and RBAC: follow-on security scope.
- Automated backup/restore tooling and an audit export: later operational releases; the supported recovery path remains manual.
- Proxmox community installer, signed/prebuilt artifacts, and automated upgrade/rollback remain later release work.

## Known limitations

- Release 0.1 supports one initial administrator and has no account-management screen.
- Health work is in-process and intentionally not represented as durable jobs; only its latest result is durable.
- The built React directory is installed alongside the Go binary rather than embedded in it.
- `insecure_http` exists for explicit homelab compatibility and exposes node credentials to that management network; it is never selected implicitly.
- Repeatable automated packaged-host backup/restore and live DNS-outage evidence remain follow-on improvements after the operator accepted the 0.1/0.1.1 production validation.
