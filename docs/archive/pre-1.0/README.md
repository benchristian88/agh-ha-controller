# Pre-1.0 Documentation Archive

These records explain how the current product was developed or validated. They
are intentionally excluded from normal operator navigation and may describe old
routes, screenshots, release states, or proposed behavior. Accepted ADRs are not
archived; they remain durable decisions in `docs/decisions/`.

Files remain at their established paths to preserve historical links. This index
is the logical archive boundary; current behavior must be documented elsewhere.

## Release validation evidence

- [Release 0.4.1 regression report](../../development/release-0.4.1-phase-10-regression-report.md)
- [Release 0.6 validation](../../development/release-0.6-validation.md)
- [Release 0.7 validation](../../development/release-0.7-validation.md)
- [Release 0.8 validation](../../development/release-0.8-validation.md)
- [Release 0.9 validation](../../development/release-0.9-validation.md)
- [Release 0.9.1 validation](../../development/release-0.9.1-validation.md)
- [Release 0.9.2 validation](../../development/release-0.9.2-validation.md)

## Frontend implementation history

- `docs/frontend/release-0.4*.md`
- `docs/frontend/screen-migration-specifications.md`
- `docs/frontend/implementation-checklist.md`
- `docs/frontend/source-of-truth-order.md`
- `docs/frontend/screenshots/release-0.4.1/`

The current UI references are the design system, component catalogue,
navigation/shell, feature-presentation, Query Log, and Operational Status docs.

## Historical planning and product exploration

- [Release plan](../../roadmap/release-plan.md)
- [Release 0.4.1 UI roadmap](../../roadmap/release-0.4.1-ui-alignment-roadmap.md)
- [Backlog](../../roadmap/backlog.md)
- [Frontend alignment brief](../../product/frontend-alignment-brief.md)
- [Product design document](../../product/product-design-document.md)
- [ADR compendium](../../decisions/ADR-compendium.md) — duplicated snapshot;
  individual ADR files are authoritative

## Rules for historical material

- Do not use it to determine current API, schema, route, install, or support
  behavior.
- Correct factual/security hazards with an explicit historical note; do not
  rewrite evidence to match later outcomes.
- Add current behavior to the product/user/admin/operations/reference docs and
  chronology to the root changelog.
