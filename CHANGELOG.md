# Changelog

All notable changes to AGH HA Controller will be documented in this file.

The project intends to follow Semantic Versioning once the first public release is made.

## 0.4.0 - Unreleased

### Added

- Release 0.4.1 Phase 5B dedicated DNS Allowlists page, shared Blocklist/Allowlist table and dialog composition, observed-only rule-count/freshness and per-node application metadata, safer removal confirmation, and audited refresh-all partial results using allowlist semantics.
- Authenticated `GET /api/v1/clusters/{clusterId}/allowlists/presentation` endpoint with category-separated stale caching and safe node-attributed metadata.
- Release 0.4.1 Phase 4 Blocked Services page with a controller-mediated, version-aware per-node catalogue; searchable grouped service selection; compatibility warnings; selected counts and group actions; shared schedule editing; and publication/deployment preflight for unsupported IDs.
- Authenticated `GET /api/v1/clusters/{clusterId}/blocked-services/catalogue` observed-metadata endpoint with bounded per-version caching, stale/partial node results, and safe metadata redaction.
- Canonical configuration schema v2 covering broader DNS behavior, blocklists and allowlists, persistent clients, DNS rewrites, blocked-service schedules, safety services, Safe Search, query-log policy, statistics policy, redacted TLS inventory, and node-specific DHCP configuration/static leases.
- Version-aware schema projection so AdGuard Home v0.107.52 and immutable schema-v1 revisions remain observable and deployable while schema v2 supports the current v0.107.53–v0.107.78 contract.
- Patch-level capability handling for upstream timeout, cache enablement, rewrite enablement, ignored-list activation, and v0.107.78 filter intervals; newer unreviewed contracts are reported as unknown.
- Capability-gated, sequential deployment of schema-v2 settings with managed-field read-back verification and safe single-active-node DHCP handoff ordering.
- Audited per-node blocklist and allowlist refresh API and partial-result UI workflow.
- AdGuard Home-style nested settings navigation and responsive forms for DNS, filters, clients, rewrites, services and safety, log/statistics policy, TLS inventory, and DHCP.
- Migration `000004_release_0_4` and ADR-0025.

### Changed

- Move Safe Browsing, parental control, and Safe Search presentation to Settings > General; `/filters/blocked-services` now contains only the blocked-service catalogue and inactivity schedule while preserving the existing desired-state fields.
- Default controller, image, installer, and web version is 0.4.0.
- Release 0.3, including Docker and systemd installation and functional validation, is recorded as complete.
- Use the primary application sidebar as the sole settings navigation and place larger DHCP node, client, and blocked-services schedule headings inside their corresponding configuration cards.

### Fixed

- Prevent the rewrites, persistent-clients, and DHCP static-lease editors from crashing on non-secure HTTP origins by using stable local row keys instead of the secure-context-only browser UUID API.
- Avoid redundant `/control/dhcp/set_config` writes when a node's schema-v2 DHCP configuration already matches the immutable revision. This prevents disabled, unconfigured DHCP nodes from rejecting an otherwise successful deployment after DNS settings have been applied, while static leases continue to reconcile.
- Include the safe AdGuard Home HTTP method, operation path, and status in `NODE_APPLY_FAILED` task details and show that existing per-node diagnostic on the Deployments page without retaining node response bodies.

### Deferred

- TLS certificate/key mutation remains excluded until controller-managed secret references exist.
- Central statistics ingestion and combined query-log ingestion remain Releases 0.5 and 0.6.
- Field-level drift ignore, parallel deployment, automatic partial recovery, and controller high availability retain their later roadmap positions.

## 0.3.2 - 2026-07-30

### Fixed

- Read node listener addresses and DNS port from AdGuard Home's `/control/status` contract during configuration inventory. The initial 0.3.0 adapter incorrectly expected those fields from `/control/dns_info`, causing imported drafts to contain empty listener overrides.
- Reject incomplete legacy snapshots at import and show node names with refresh/re-import guidance instead of opaque `nodeOverrides.<uuid>` validation messages.
- Treat an unset cluster `active_revision_id` as `false` when loading revisions. PostgreSQL comparison with `NULL` previously caused an internal error while a published revision had not yet been activated and failed the Release 0.3 integration workflow before its first deployment.

## 0.3.0 - 2026-07-30

### Added

- Separate authoritative schema-v1 desired documents with shared DNS/filtering policy and per-node listener overrides.
- Optimistic draft editing/validation, immutable numbered revisions, semantic revision comparison, and deployment-based rollback.
- Durable sequential deployments with all-target preflight, per-node tasks, safe cancellation, restart interruption, read-back verification, active/applied revision state, and complete audit history.
- Supported AdGuard Home DNS/filtering writer with whitelist preservation and safe error mapping.
- Deduplicated drift events, Manual/Alert/Enforce reconciliation, automatic verified restoration, maintenance mode, and convergence state.
- Versioned revision/deployment/drift APIs plus React draft, history, deployment timeline, policy, and drift-action surfaces.
- Migration `000003_release_0_3`, ADR-0024, unit/contract coverage, and the two-node Release 0.3 integration workflow.

### Changed

- Default controller, image, installer, and web version is 0.3.0.
- Releases 0.2, 0.2.1, and 0.2.2 are recorded as operator-validated.

### Deferred

- Listener writes, whitelist authoring, wider AdGuard settings, field-level ignore rules, parallel/rolling strategies, scheduled maintenance windows, and richer partial-deployment recovery.

## 0.2.2 - 2026-07-29

### Fixed

- Restart and verify the systemd service after replacing release artifacts. Previous upgrade reruns used `systemctl enable --now`, which left an already-running older API process serving a newly installed frontend.

## 0.2.1 - 2026-07-29

### Fixed

- Prevent the Configuration page from crashing when a cluster has no imported draft. The API now omits an absent draft, while the UI remains compatible with the `draft: null` response emitted by 0.2.0.

## 0.2.0 - 2026-07-29

### Added

- Canonical configuration schema v1 for read-only DNS and filtering inventory.
- Version-aware capability profiles and immutable successful/failed node snapshots.
- Ownership-aware semantic diff API and configuration comparison UI.
- Explicit, audited import into an optimistic non-authoritative cluster draft.
- AdGuard Home v0.107.52 and v0.107.61 compatibility fixtures.
- Migration `000002_release_0_2` and ADR-0023.

### Changed

- Default controller and web version is 0.2.0.
- Production Make builds no longer require ripgrep, fixing the systemd installer warning.
- Roadmap records operator validation of Releases 0.1 and 0.1.1.

## 0.1.1 - 2026-07-28

### Added

- Production Dockerfile and Docker Compose installation with PostgreSQL persistence, health checks, non-root/read-only controller runtime, and source builds.
- Git-checkout Debian/systemd installer that builds the application, provisions PostgreSQL and the service account, generates protected secrets, and preserves existing runtime configuration on upgrade.
- Explicit regression coverage that the one-time initial administrator setup cannot be repeated.

### Changed

- Default build and runtime version is 0.1.1.
- Installation, architecture, operations, security, product, and roadmap documentation now describe the supported Docker and systemd paths.
- CI uses its PostgreSQL service directly.

### Removed

- Disposable local Compose/node-simulator environment and its Make/script/documentation surface.

### Added

- Release 0.1 PostgreSQL schema and checksum-protected migration runner.
- First-run local administrator, Argon2id authentication, secure sessions, CSRF protection, and login throttling.
- Audited cluster and node management APIs with optimistic concurrency.
- AES-256-GCM encrypted node credentials and explicit TLS trust policies.
- Read-only AdGuard Home health/version adapter and automatic polling.
- React dark-mode setup, login, dashboard, node-management, and audit surfaces.
- Health/readiness endpoints, request IDs, stable API errors, build tooling, tests, and CI.
- ADR-0021 and Release 0.1 feature ledger.

### Changed

- Reconciled architecture, API, database, security, testing, operations, and roadmap documentation with the implemented Release 0.1 design.

### Earlier scaffold

- Initial repository scaffold.
- Architecture documentation.
- Roadmap and release plan.
- Frontend design specification.
- Database design specification.
- Security and operations documentation.
- AI and contributor instructions.
