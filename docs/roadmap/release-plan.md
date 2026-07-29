# Release Plan

## Versioning

Pre-1.0 releases may introduce breaking changes but should still include migrations and upgrade notes.

After 1.0, use Semantic Versioning:

- Major: incompatible API, schema, or behaviour changes.
- Minor: backward-compatible features.
- Patch: backward-compatible fixes.

## Release gates

Every release requires:

- Passing unit, integration, and applicable end-to-end tests.
- Successful database migration from the prior release.
- Documented upgrade path.
- Security review of changed boundaries.
- Updated changelog.
- Compatibility notes.
- Reproducible binaries and images.
- Smoke test on the reference Debian LXC topology.

## Branch model

Recommended:

- `main`: releasable state.
- Short-lived feature branches.
- Tagged releases.
- Release branches only when long-lived patch support becomes necessary.

## Initial milestone mapping

| Milestone | Primary value |
|---|---|
| 0.1 | See and manage nodes |
| 0.2 | Understand configuration differences |
| 0.3 | Control and reconcile configuration |
| 0.4 | Manage most AGH features |
| 0.5 | See cluster statistics |
| 0.6 | Search combined query logs |
| 0.7 | Trial forwarder ingestion |
| 0.8 | Production event ingestion |
| 0.9 | Operate and maintain HA safely |
| 1.0 | Community-ready production release |

## Current implementation status

| Milestone | Status | Notes |
|---|---|---|
| 0.1 | Complete | Foundation and production-build LXC functionality validated by the operator. |
| 0.1.1 | Complete | Docker and systemd production-build installs validated; the non-fatal ripgrep build warning is fixed in 0.2. |
| 0.2 / 0.2.1 / 0.2.2 | Complete | Inventory, empty-draft fix, and atomic systemd upgrade behavior were operator-validated by 30 July 2026. |
| 0.3 | Implemented; release gate pending | Authoritative drafts/revisions, verified two-node deployment, rollback, drift policies, enforcement, maintenance, API/UI, migration, tests, and docs are present. PostgreSQL/reference-node execution remains required before tagging complete. |
| 0.4–1.0 | Planned | Historical scope and sequencing are unchanged. |
