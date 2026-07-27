# Product Roadmap

## Product outcome

Deliver a simple, reliable HA management experience for AdGuard Home where operators manage a resilient DNS cluster from one place.

The roadmap prioritises configuration control before central statistics because safe desired-state management is the core product differentiator.

## Release 0.1 — Foundation

**Current status (27 July 2026): Partially completed — implementation is present; external release validation is pending.**

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
- Reproducible Compose test environment with PostgreSQL 17, two authenticated status-contract nodes, non-skipping Make targets, and exact clean-checkout README commands.

Partially completed or validation pending:

- PostgreSQL migration and API integration tests run through `make test-local`; a hosted execution result is still pending.
- Two-node onboarding is contract-tested; two real AdGuard Home nodes have not yet been recorded as passing.
- CI is configured but a hosted workflow result is not available in this repository state.
- systemd packaging is defined, but a fresh Debian 13 LXC installation has not been repeated.
- Controller shutdown has no DNS code path and leaves the local contract node running, but the required real DNS outage test remains pending.
- The documented manual PostgreSQL plus secret backup/restore smoke test remains pending.

Deliberately deferred from 0.1:

- Detailed capability documents and configuration observation remain 0.2 work.
- Account management, password recovery/change, and durable distributed rate limiting are follow-on authentication work; 0.1 provides the initial administrator and secure local session flow.
- Cluster deletion is withheld until historical revision/deployment relationships have a safe lifecycle design.

New follow-on dependencies:

- Select and provision the real AdGuard Home versions used for the initial compatibility statement.
- Add browser-driven setup/login/two-node tests to the reference environment.
- Exercise HTTPS reverse-proxy cookie behavior and Debian file placement.
- Complete backup/restore and uninterrupted-DNS evidence before changing this release to complete.

## Release 0.2 — Configuration inventory

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

## Release 0.3 — Authoritative configuration MVP

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

## Release 0.4 — Broader AdGuard Home coverage

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
- Docker Compose.
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
