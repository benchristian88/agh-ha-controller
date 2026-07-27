# Changelog

All notable changes to AGH HA Controller will be documented in this file.

The project intends to follow Semantic Versioning once the first public release is made.

## Unreleased

### Added

- Release 0.1 PostgreSQL schema and checksum-protected migration runner.
- First-run local administrator, Argon2id authentication, secure sessions, CSRF protection, and login throttling.
- Audited cluster and node management APIs with optimistic concurrency.
- AES-256-GCM encrypted node credentials and explicit TLS trust policies.
- Read-only AdGuard Home health/version adapter and automatic polling.
- React dark-mode setup, login, dashboard, node-management, and audit surfaces.
- Health/readiness endpoints, request IDs, stable API errors, build tooling, tests, and CI.
- Reproducible local Compose environment with PostgreSQL 17, two authenticated node-contract simulators, Make targets, and clean-checkout README commands.
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
