# Feature Ledger

This ledger records implemented behavior separately from roadmap intent. “Implemented” does not mean the release gate has passed; external validation is listed explicitly.

## Release 0.1 foundation

| Feature | Status | Implementation and evidence | Remaining release validation |
|---|---|---|---|
| Reliable controller startup | Implemented; external install pending | Environment validation, PostgreSQL connection, checksum-protected migrations, worker startup, bounded HTTP server, graceful shutdown | Fresh Debian 13 LXC installation and restart exercise |
| First-run administrator | Implemented | One-time serialized setup; public URL/time/security checks; Argon2id password; setup UI and API | Browser-driven end-to-end test on packaged build |
| Local login and sessions | Implemented | Generic login failures, in-process throttling, HMAC-hashed opaque sessions, expiry/revocation, strict cookies, CSRF, logout audit | Packaged HTTPS/reverse-proxy cookie validation |
| Cluster management | Implemented | Create/list/get/update API, optimistic version, typed UI creation/selection, transactional audit | Cluster deletion deliberately excluded pending historical-lifecycle design |
| Node management | Implemented; real nodes pending | Create/list/get/update/test/disable/soft-remove, exact-name removal validation, optimistic version, typed UI | Onboard two real supported AdGuard Home nodes |
| Encrypted node credentials | Implemented | AES-256-GCM envelope, node UUID binding, external key, write-only API fields, rotation/removal audit, redaction tests | Backup/restore smoke test with production secret files |
| Status/version adapter | Implemented; compatibility scope narrow | Read-only `/control/status`, Basic auth, bounded direct transport, system/custom CA trust, distinct TLS/auth/network/payload errors, `v0.107.x` contract tests | Publish results against selected real supported versions |
| Automatic node health | Implemented | Immediate and interval polling, four-probe bound, durable last-seen/poll/error/latency/version state, stale UI | Restart recovery against real nodes |
| Dashboard shell | Implemented | Responsive dark shell, cluster selector, node cards, textual states, stale and partial failure, no meaningless telemetry charts | Browser accessibility and packaged visual smoke tests |
| Audit foundation | Implemented | Append-only application API; login/setup/cluster/node/credential/manual-test/logout records; request IDs; safe metadata; audit UI | Export intentionally deferred; database permission hardening follow-up |
| Liveness and readiness | Implemented | Public process liveness and PostgreSQL-aware readiness | Reference monitoring/systemd exercise |
| Local test environment | Implemented; hosted run pending | Root Compose project with PostgreSQL 17 and two authenticated status simulators; sourceable fixture environment; non-skipping integration/race Make targets; exact README workflow | Successful execution on a Docker-capable host and hosted CI |
| CI baseline | Implemented; remote run pending | Compose environment startup, Go format/vet/race tests/build, PostgreSQL/two-node integration workflow, frontend Biome/type/test/build, production dependency audit | Successful GitHub Actions run |

## Deliberately deferred

- Detailed capability discovery, configuration observation, import, canonical comparison, and compatibility warnings: Release 0.2.
- Drafts, immutable revisions, deployment, rollback, drift, reconciliation, and maintenance mode: Release 0.3.
- Statistics and query logs: Releases 0.5 and 0.6.
- Additional local-user management, password change/recovery, durable or distributed login throttling, OIDC, and RBAC: follow-on security scope.
- Automated backup/restore tooling and an audit export: later operational releases; manual 0.1 validation remains required.
- Controller Docker deployment and Proxmox installers: Release 1.0. The 0.1 Compose file is test infrastructure, not a deployment mode.

## Known limitations

- Release 0.1 supports one initial administrator and has no account-management screen.
- Health work is in-process and intentionally not represented as durable jobs; only its latest result is durable.
- The built React directory is installed alongside the Go binary rather than embedded in it.
- `insecure_http` exists for explicit homelab compatibility and exposes node credentials to that management network; it is never selected implicitly.
- Real-node onboarding, Debian packaging, backup/restore, and live DNS outage gates require external environments and must not be inferred from the deterministic local contract simulators.
