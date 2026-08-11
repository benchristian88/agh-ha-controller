# Release Plan

> Historical pre-1.0 planning record. It is retained for traceability and does
> not define current features or future commitments. See the root changelog and
> the forward-looking [roadmap](../../../roadmap/roadmap.md).

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
| 0.7 | Operational hardening and observability |
| 0.8 | HA operations and lifecycle |
| 0.9 | Product and release hardening |
| 1.0 | Rename, stability, and supported release |

## Current implementation status

| Milestone | Status | Notes |
|---|---|---|
| 0.1 | Complete | Foundation and production-build LXC functionality validated by the operator. |
| 0.1.1 | Complete | Docker and systemd production-build installs validated; the non-fatal ripgrep build warning is fixed in 0.2. |
| 0.2 / 0.2.1 / 0.2.2 | Complete | Inventory, empty-draft fix, and atomic systemd upgrade behavior were operator-validated by 30 July 2026. |
| 0.3 / 0.3.1 / 0.3.2 | Complete | Authoritative deployment, rollback, drift/Enforce, Docker, systemd, and functional workflows were operator-validated by 30 July 2026. |
| 0.4 | Complete | Schema v2 and broader control-plane behavior remain the foundation for 0.4.1; functional, Docker, and native/systemd installation validation completed 3 August 2026. |
| 0.4.1 | Complete | Frontend alignment and the distinct HA page responsibilities were completed and validated before 0.5/0.6. Historical phase reports retain the original evidence. |
| 0.5 | Complete and validated | Exact-range polling/storage/aggregation, coverage-aware API/UI, and retention are confirmed working. Release 0.7 hardens but does not redesign them. |
| 0.6 | Complete and validated | API-polled normalized ingestion, retention, search/filter/keyset API, coverage/gaps, Query Log UI, and draft handoffs are confirmed working. |
| 0.7 | Complete and validated | The operator confirmed all functional, PostgreSQL, browser, Docker, and native/systemd gates on 9 August 2026; the historical validation report remains unchanged. |
| 0.8 | Complete and validated | Active DNS/HA health, lifecycle coordination, certificate/version awareness, guided upgrades, notifications, API/UI, migration, real-node, PostgreSQL, browser, Docker, and native/systemd gates were operator-validated on 9 August 2026. |
| 0.9 | Implemented; external gates pending | Productisation, Backup & Upgrade Readiness: secure Standard/Full backup/download/preflight plus offline CLI restore; cached AGH HA Controller update awareness and safe host-guided execution; User Administration; branding/PWA assets; state-backed Setup Guide; rationalised System Settings; About/build/compatibility attribution; compatibility/support policy, security review, accessibility/browser hardening, and package parity. Feature freeze follows external validation. |
| 0.9.1 | Implemented; external gates pending | System/Light/Dark browser preference, Atlas visual asset foundation, accessible coordinated header/menu UX, and reconciled favicon/Apple/PWA metadata. Local automated gates pass; real-browser/iOS evidence and inherited 0.9 external gates remain open. |
| 0.9.2 | Implemented; external gates pending | Product polish, documentation consolidation, Node Detail, complete webhook administration, lifecycle archive/delete safety, and final shared UI spacing consistency are implemented. Local automated gates pass; inherited packaged-browser, platform, PostgreSQL, backup/restore, and real-node gates remain open. |
| 1.0 | Planned | Stable supported release after the frozen 0.9 surface passes every release gate. |
