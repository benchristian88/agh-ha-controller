# Changelog

All notable changes to AGH HA Controller will be documented in this file.

The project intends to follow Semantic Versioning once the first public release is made.

## Unreleased

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
