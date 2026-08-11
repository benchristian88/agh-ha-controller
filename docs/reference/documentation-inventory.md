# Documentation Inventory

This inventory classifies every significant documentation family. A glob entry
classifies every file in that family unless an explicit row overrides it.

| Path or family | Classification | Role |
|---|---|---|
| `README.md` | CURRENT PRODUCT DOCUMENTATION | Product front door and quick start. |
| `SECURITY.md`, `CONTRIBUTING.md`, `AGENTS.md` | CURRENT PRODUCT DOCUMENTATION | Repository policy and contributor entry points. |
| `CHANGELOG.md` | HISTORICAL / DEVELOPMENT | Single authoritative release chronology. |
| `docs/README.md` | CURRENT PRODUCT DOCUMENTATION | Documentation navigation. |
| `docs/getting-started/*` | CURRENT PRODUCT DOCUMENTATION | Authoritative Docker and native/systemd installation. |
| `docs/user-guide/*` | CURRENT PRODUCT DOCUMENTATION | Visible operator workflows. |
| `docs/administration/*` | CURRENT PRODUCT DOCUMENTATION | Users, webhooks, lifecycle, backup, updates, settings, audit. |
| `docs/operations/runbook.md` | CURRENT PRODUCT DOCUMENTATION | Runtime diagnosis and recovery. |
| `docs/operations/backup-and-restore.md` | CURRENT PRODUCT DOCUMENTATION | Portable backup and offline restore procedure. |
| `docs/operations/backup-format.md` | REFERENCE / ARCHITECTURE | Portable archive contract. |
| `docs/operations/compatibility-matrix.md` | CURRENT PRODUCT DOCUMENTATION | Tested/expected/unsupported boundaries. |
| `docs/reference/features.md` | CURRENT PRODUCT DOCUMENTATION | Sole authoritative feature catalogue. |
| `docs/reference/rename-inventory.md` | REFERENCE / ARCHITECTURE | Release 1.0 systematic rename scope. |
| `docs/reference/documentation-inventory.md` | REFERENCE / ARCHITECTURE | Documentation governance. |
| `docs/architecture/*` | REFERENCE / ARCHITECTURE | Current system, configuration, deployment, and reconciliation boundaries. |
| `docs/api/*` | REFERENCE / ARCHITECTURE | Controller and node integration contracts. |
| `docs/backend/*` | REFERENCE / ARCHITECTURE | Detailed service/worker behavior. |
| `docs/database/*` | REFERENCE / ARCHITECTURE | Schema, data design, and retention. |
| `docs/diagrams/*` | REFERENCE / ARCHITECTURE | System, database, and sequence diagrams. |
| `docs/security/security.md` | CURRENT PRODUCT DOCUMENTATION | Current security controls and operating guidance. |
| `docs/decisions/ADR-0001*`–`ADR-0032*` | REFERENCE / ARCHITECTURE | Canonical decision history; status is indexed in `decisions/README.md`. |
| `docs/decisions/README.md` | REFERENCE / ARCHITECTURE | ADR status register. |
| `docs/frontend/design-system.md` | REFERENCE / ARCHITECTURE | Current visual primitives. |
| `docs/frontend/component-catalogue.md` | REFERENCE / ARCHITECTURE | Current shared components. |
| `docs/frontend/navigation-and-shell.md`, `ui-navigation.md` | REFERENCE / ARCHITECTURE | Current route/navigation behavior; consolidate if either diverges. |
| `docs/frontend/feature-presentation-rules.md`, `frontend-design.md`, `ha-controller-responsibility-separation.md`, `query-log.md`, `operational-status.md`, `theme-brand-and-pwa.md` | REFERENCE / ARCHITECTURE | Current frontend behavior and boundaries. |
| `docs/development/coding-standards.md`, `local-development.md`, `regression-safety-rules.md`, `release-process.md`, `testing.md` | CURRENT PRODUCT DOCUMENTATION | Active contributor documentation. |
| `docs/development/release-*.md` | HISTORICAL / DEVELOPMENT | Point-in-time validation evidence. |
| `docs/frontend/release-*.md`, `screen-migration-specifications.md`, `implementation-checklist.md`, `source-of-truth-order.md` | HISTORICAL / DEVELOPMENT | Pre-1.0 UI implementation/audit material. |
| `docs/frontend/screenshots/release-0.4.1/*` | HISTORICAL / DEVELOPMENT | Point-in-time visual evidence, not current product imagery. |
| `docs/roadmap/roadmap.md` | CURRENT PRODUCT DOCUMENTATION | Forward-looking direction only. |
| `docs/roadmap/release-plan.md`, `release-0.4.1-ui-alignment-roadmap.md`, `backlog.md` | HISTORICAL / DEVELOPMENT | Superseded chronology/planning inputs. |
| `docs/product/support-and-deprecation-policy.md` | CURRENT PRODUCT DOCUMENTATION | Pre-1.0 support boundaries. |
| `docs/product/feature-ledger.md` | OBSOLETE / DUPLICATED | Retired pointer; catalogue/changelog own its former roles. |
| `docs/product/product-design-document.md`, `frontend-alignment-brief.md` | HISTORICAL / DEVELOPMENT | Original product and alignment exploration. |
| `docs/decisions/ADR-compendium.md` | OBSOLETE / DUPLICATED | Snapshot duplicating canonical individual ADR files. |
| `docs/archive/pre-1.0/README.md` | HISTORICAL / DEVELOPMENT | Navigation boundary for retained history. |
| `scripts/README.md` | CURRENT PRODUCT DOCUMENTATION | Narrow script reference; install commands live in getting-started guides. |

## Governance

- Current docs describe capabilities and operation by task, never by release.
- The root changelog owns chronology; the roadmap owns only future direction.
- Individual ADRs own decision history. Do not update the compendium.
- Historical files stay link-stable and outside normal docs navigation.
- A behavior change updates the relevant current guide, reference, API/schema
  contract, and changelog entry in the same change.
