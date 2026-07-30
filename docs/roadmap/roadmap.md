# Product Roadmap

## Product outcome

Deliver a simple, reliable HA management experience for AdGuard Home where operators manage a resilient DNS cluster from one place.

The roadmap prioritises configuration control before central statistics because safe desired-state management is the core product differentiator.

## Release 0.1 — Foundation

**Current status (29 July 2026): Complete — production LXC installation and functionality were successfully validated by the operator.**

### Outcomes

- Controller can start reliably.
- Administrator can log in.
- Administrator can register AdGuard Home nodes.
- Controller can show node health and version.

### Scope

- Go service scaffold.
- PostgreSQL migrations.
- Local user authentication.
- Secure browser sessions.
- Encrypted node credentials.
- Node CRUD.
- AdGuard Home API client.
- Health and version polling.
- Dashboard shell.
- Audit log foundation.
- Health and readiness endpoints.
- CI for tests, linting, and builds.

### Exit criteria

- Two nodes can be onboarded.
- Credentials are not exposed in logs or API responses.
- Node health updates automatically.
- DNS operation is unaffected by controller shutdown.

### Implementation reconciliation

Completed in the repository:

- Go controller, migration command, PostgreSQL schema and repositories.
- One-time local administrator setup, Argon2id login, expiring/revocable sessions, CSRF, and throttling.
- AES-256-GCM node credential envelopes with external key material.
- Audited cluster create/list/get/update and node create/list/get/update/test/disable/remove workflows.
- Read-only AdGuard Home status/version adapter with system trust, custom CA, and explicit plaintext policy.
- Immediate and interval health polling with stale/partial-failure dashboard states.
- Dark React dashboard, node management, and audit surfaces.
- Liveness/readiness endpoints and CI definitions for format, vet, race tests, PostgreSQL integration, frontend validation, dependency audit, and builds.

Historical validation record (resolved by the operator's 29 July 2026 production-build validation):

- PostgreSQL migration and API integration tests run when an explicit `TEST_DATABASE_URL` is supplied; a hosted execution result is still pending.
- Two-node onboarding is contract-tested; two real AdGuard Home nodes have not yet been recorded as passing.
- CI is configured but a hosted workflow result is not available in this repository state.
- systemd packaging is defined, but a fresh Debian 13 LXC installation has not been repeated.
- Controller shutdown has no DNS code path and leaves the local contract node running, but the required real DNS outage test remains pending.
- The documented manual PostgreSQL plus secret backup/restore smoke test remains pending.

Deliberately deferred from 0.1:

- Detailed capability documents and configuration observation remain 0.2 work.
- Account management, password recovery/change, and durable distributed rate limiting are follow-on authentication work; 0.1 provides the initial administrator and secure local session flow.
- Cluster deletion is withheld until historical revision/deployment relationships have a safe lifecycle design.

Follow-on improvements that did not block the accepted 0.1 release:

- Select and provision the real AdGuard Home versions used for the initial compatibility statement.
- Add browser-driven setup/login/two-node tests to the reference environment.
- Exercise HTTPS reverse-proxy cookie behavior and Debian file placement.
- Preserve repeatable backup/restore and uninterrupted-DNS evidence in future automated release jobs.

## Release 0.1.1 — Git-based installation

**Current status (29 July 2026): Complete — Docker and systemd production-build installs were successfully validated.**

Completed in the repository:

- Production multi-stage controller image and Docker Compose stack with PostgreSQL 17 persistence and health checks.
- Non-root, read-only container execution with no DNS port or DNS data-path responsibility.
- Debian/systemd installer that builds from a git checkout, provisions PostgreSQL and the service identity, generates protected secrets, and installs the existing hardened service.
- One-time first-administrator behavior verified by database locking and repeat-setup regression coverage.
- Installation, upgrade, architecture, security, operations, README, feature-ledger, and release documentation.

Historical validation record (resolved by successful Docker and systemd production-build installs on 29 July 2026):

- Fresh Docker-enabled LXC and Debian 13 LXC installation smoke tests.
- Restart and git-based upgrade reruns for both installation modes.
- PostgreSQL plus runtime-secret backup/restore using each packaged topology.
- Browser-driven first-admin setup on each packaged build.

Deliberately deferred:

- Prebuilt images/binaries, checksums, SBOM, release signing, automatic rollback, and Proxmox community installation.
- External PostgreSQL Compose profiles and controller high availability.

Follow-on improvements that did not block the accepted 0.1.1 release:

- Publish immutable git tags so operators can select and roll back source versions predictably.
- Add packaged-install smoke jobs on a Docker host and clean Debian LXC.

## Release 0.2 — Configuration inventory

**Current status (30 July 2026): Complete — configuration inventory and all patch-line fixes were operator-validated.**

### Outcomes

- Controller can read and compare supported configuration from every node.
- Operator can understand how nodes differ.

### Scope

- Capability discovery.
- Canonical configuration model.
- Shared versus node-specific classification.
- Node configuration snapshots.
- Structured diff engine.
- Import workflow.
- Configuration comparison UI.
- Compatibility warnings.

### Exit criteria

- Two materially equivalent nodes compare as equal.
- Real differences are displayed by section.
- Volatile API fields do not create false drift.

### Implementation reconciliation

Completed in the repository:

- Canonical schema v1 with shared-managed, node-specific, observed-only, unsupported, and volatile classifications.
- Read-only DNS and filtering collection with v0.107.52 and v0.107.61 contract fixtures.
- Immutable successful/failed observations, current capability profiles, deterministic hashes, and section/scope structured differences.
- Confirmed, audited, optimistic import into a non-authoritative cluster draft.
- Configuration inventory UI with refresh, warnings, semantic equality, detailed comparison, and import boundary messaging.
- Portable production Make source discovery fixing the non-fatal systemd ripgrep warning reported during successful 0.1.1 validation.
- Release 0.2.1 fixes the blank Configuration page seen when 0.2.0 returned `draft: null` before the first import.
- Release 0.2.2 fixes systemd upgrade reruns that installed the new frontend and binary without restarting an already-running older controller process.

Deliberately deferred:

- Revision publication, desired-state activation, convergence, deployment, rollback, drift, and reconciliation remain Release 0.3.
- TLS, DHCP, clients, rewrites, blocked services, and safety-service inventory remain broader Release 0.4 coverage.
- Automatic scheduled observation remains follow-on work; 0.2 refresh is operator initiated and durable.

Production validation checklist subsequently completed by the operator on 30 July 2026:

- Upgrade a 0.1.1 production database through migration 000002.
- Compare two real materially equivalent nodes and one intentional difference.
- Confirm read-only endpoint compatibility and draft import on the release LXC.

## Release 0.3 — Authoritative configuration MVP

**Current status (30 July 2026): Complete — PostgreSQL workflow, reference functionality, Docker, and systemd validation were completed by the operator.**

### Outcomes

- Controller becomes the source of truth.
- Changes are revisioned.
- Nodes can be safely deployed and reconciled.
- Drift is detected and corrected.

### Scope

- Draft configuration.
- Validation.
- Immutable revisions.
- Revision comparison.
- Sequential deployment.
- Per-node effective configuration.
- Read-back verification.
- Rollback.
- Reconciliation policies.
- Automatic drift correction.
- Deployment and drift audit trail.
- Maintenance mode.

### Exit criteria

- Operator can deploy one revision to two nodes.
- Both nodes verify as converged.
- A manual change on a node is detected.
- Enforce mode restores the desired state.
- A previous revision can be rolled back safely.

This is the first release that demonstrates the complete core value proposition.

### Implementation reconciliation — 30 July 2026

Implemented:

- Authoritative schema-v1 drafts remain distinct from observed documents and require one listener override per enabled node.
- Publishing creates immutable numbered revisions; revision comparison is semantic and rollback deploys an existing historical revision.
- Published revisions remain explicitly inactive until a deployment succeeds; PostgreSQL revision reads handle the cluster's initially null `active_revision_id` without an API/internal error.
- PostgreSQL-backed deployments validate every target before the first mutation, run sequentially, stop after the first failure, preserve partial success, support safe-boundary cancellation, and record per-node verification snapshots.
- Shared DNS resolver and filtering blocklist/rule settings use supported AdGuard Home HTTP endpoints. DNS listener values are preflight-only, whitelist filters are untouched, and node YAML is never edited.
- Listener addresses and DNS port are collected from AdGuard Home's `/control/status` contract. Incomplete observations and legacy snapshots are rejected before import so an invalid node override cannot be published.
- A revision becomes active only after every target verifies by read-back.
- Durable deduplicated drift events support Manual, Alert, and Enforce policies; Enforce queues the same verified targeted deployment. Maintenance suppresses mutation.
- The React UI provides desired-state editing, validation, revision actions, deployment progress/history, reconciliation policy, and drift restore/adopt/maintenance actions.

Historical validation items, completed by the operator on 30 July 2026:

- The PostgreSQL two-node integration workflow covering deploy, convergence, direct drift, Enforce restoration, and rollback.
- Reference AdGuard Home write/read-back plus packaged Docker and systemd 0.3 smoke validation.

Deliberately deferred without changing roadmap history:

- Field-level drift ignore is not exposed because schema v1 already excludes unmanaged/volatile fields; explicit ignore-rule persistence belongs to broader reconciliation controls.
- Automatic retry inside a potentially partial filter mutation is withheld. Enforce can create a later fresh attempt after observation; richer retry/backoff and partial recovery remain follow-on work.
- Parallel/rolling deployments, schedules, maintenance windows, and wider AdGuard Home settings remain in later releases.

## Release 0.4 — Broader AdGuard Home coverage

**Current status (30 July 2026): Implemented; reference-node, browser, migration-upgrade, and packaged-install release validation pending.**

### Outcomes

- Most routine AdGuard Home administration can be performed through the controller.

### Scope

- DNS configuration.
- Filters and refresh operations.
- Custom filtering rules.
- Persistent clients.
- DNS rewrites.
- Blocked services.
- Safe browsing.
- Parental controls.
- Safe search.
- Query-log settings.
- Statistics settings.
- TLS modelling.
- DHCP inventory and single-active-node management.

### Exit criteria

- Supported settings are documented.
- Unsupported settings are visible.
- Capability validation prevents unsafe deployment.

### Implementation reconciliation — 30 July 2026

Implemented:

- Canonical schema v2 with deterministic shared DNS, allowlist/blocklist, clients, rewrites, blocked-service schedules, safety/Safe Search, query-log/statistics policy, redacted TLS inventory, and node-specific DHCP/static leases.
- Migration `000004_release_0_4` permits v1 and v2 without rewriting immutable records. v0.107.52 remains on v1; the reviewed v0.107.53–v0.107.78 contract uses v2 with patch-level capabilities. Historical v1 verification, rollback, and drift reconciliation project current observations to v1.
- Version-aware reads/writes through supported AdGuard HTTP endpoints, explicit feature flags, all-target capability validation, and managed-only semantic convergence.
- Audited blocklist/allowlist refresh with visible fleet partial results.
- At-most-one-active DHCP validation and disable-before-enable sequential handoff ordering.
- AdGuard Home-style nested settings navigation with accessible responsive draft editors, schema-upgrade guidance, TLS redaction messaging, and DHCP role controls.
- ADR-0025, adapter/domain/control-plane/inventory tests, expanded two-node fixture coverage, and updated architecture/API/database/security/operations/product documentation.

Partially completed or validation pending:

- The full Go race suite, vet, controller build, frontend type/test/lint/production build, shell syntax, production dependency audit, and diff check pass locally. The PostgreSQL migration/authoritative integration workflow compiled but requires `TEST_DATABASE_URL` and remains to be executed for this release in the reference environment; Compose validation was unavailable because this workspace has no Docker CLI.
- Browser accessibility/visual workflows, real supported-version node write/read-back, DHCP handoff, Docker upgrade, and systemd upgrade remain 0.4 release gates.

Post-implementation correction on 31 July 2026:

- Settings-editor row keys no longer depend on the secure-context-only browser UUID API. Rewrites, persistent clients, and DHCP static leases now render on explicit HTTP origins; the frontend regression suite, type check, lint, and production build pass. The broader browser accessibility/visual release gate remains pending.
- The application sidebar is now the sole settings navigation, removing the repeated in-page menu, and larger DHCP node, client, and blocked-services schedule headings render inside their configuration cards while retaining accessible fieldset labels. The same frontend gates pass; the browser visual release gate remains pending.

Deliberately deferred without changing roadmap history:

- TLS certificate/key mutation is excluded until controller-managed secret references are designed; TLS is redacted inventory only.
- 0.4 manages node-local query-log/statistics policy but does not ingest events. Aggregated statistics remain 0.5 and combined query logs remain 0.6.
- Field-level drift ignore, automatic recovery within a partially applied node mutation, parallel/rolling deployment, maintenance windows, and controller HA keep their later roadmap positions.

New follow-on dependencies:

- Maintain explicit schema-version fixtures when adding configuration fields or raising the minimum supported AdGuard Home version.
- TLS mutation requires a secret-reference lifecycle and audit/export redaction design before any writer is added.

## Release 0.5 — Cluster statistics

### Outcomes

- Dashboard shows aggregated node statistics.
- Operators can switch between cluster and node views.

### Scope

- Statistics polling.
- Snapshot storage.
- Aggregation logic.
- Weighted metrics.
- Cluster dashboard.
- Node attribution.
- Retention and rollups.

### Exit criteria

- Cluster totals reconcile with node totals.
- Metrics with invalid aggregation semantics are not misleadingly combined.

## Release 0.6 — Combined query log via API polling

### Outcomes

- Query log from every node is searchable in one interface.

### Scope

- Cursor-based polling.
- Deduplication.
- Combined query-event table.
- Filters by node, client, domain, status, and time.
- Retention configuration.
- Ingestion lag reporting.

### Exit criteria

- Duplicate events are controlled.
- Polling resumes after controller restart.
- Node attribution is preserved.

## Release 0.7 — Forwarder preview

### Outcomes

- High-fidelity query events can be delivered without API polling limitations.

### Scope

- Go forwarder.
- File rotation detection.
- Persistent checkpoint.
- Batch upload.
- Compression.
- Local disk spool.
- Authentication.
- Forwarder health UI.

## Release 0.8 — Production query ingestion

### Outcomes

- Forwarder becomes the preferred ingestion mode.
- Statistics can be computed from central raw events.

### Scope

- At-least-once delivery.
- Controller deduplication.
- Backpressure.
- Upgrade compatibility.
- Hourly and daily rollups.
- Raw-event retention controls.
- Polling fallback.

## Release 0.9 — Operational HA

### Outcomes

- Routine maintenance and node upgrades can be managed safely.

### Scope

- Maintenance mode.
- Rolling deployment controls.
- Node drain guidance.
- Upgrade readiness.
- Expanded health probes.
- Alert integrations.
- Backup and restore validation.

## Release 1.0 — Community production release

### Outcomes

- Stable installation and upgrade experience.
- Complete operator documentation.
- Supported configuration and compatibility matrix.

### Scope

- Debian installation.
- Hardened published Docker Compose artifacts (source-build Compose delivered in 0.1.1).
- Proxmox LXC installer.
- Upgrade and rollback tooling.
- Backup and restore documentation.
- Security hardening.
- Performance testing.
- Public API documentation.
- Contribution and release governance.

## Future releases

- OIDC and Authentik integration.
- Role-based access control.
- Multiple clusters and sites.
- Controller high availability.
- MSP multi-tenancy.
- Remote collector architecture.
- Enhanced DHCP coordination.
- Automated node upgrade orchestration.
- Notifications and external alerting.
