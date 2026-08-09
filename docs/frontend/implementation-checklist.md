# UI Alignment Implementation Checklist

## Phase 0

- [ ] Create migration branch.
- [ ] Record screenshots of every current route (the representative Phase 10 breakpoint/theme set is complete).
- [x] Run existing tests.
- [x] Create route inventory.
- [ ] Catalogue existing reusable components.
- [x] Add explicit Not Found behaviour.

## Foundation

- [x] Horizontal header.
- [x] Settings dropdown.
- [x] Filters dropdown.
- [x] HA Controller dropdown.
- [x] Mobile drawer.
- [x] Context row.
- [x] Active revision.
- [x] Cluster health.
- [x] Active deployment.
- [x] Route redirects.
- [x] Shared page widths.
- [x] Light/dark tokens.

## Configuration Control

- [x] Rename to Configuration Control.
- [x] Remove schema-v1 wording.
- [x] Remove duplicate narrow editor.
- [x] Add schema-v2 draft summary.
- [x] Add links to authoring pages.
- [x] Preserve validation/publication while moving immutable history, comparison, and rollback to Revisions.
- [x] Preserve advanced observation/import.

## HA Controller responsibility separation

- [x] Distinct Nodes infrastructure page.
- [x] Distinct Configuration Control approval/publication page.
- [x] Distinct Deployments execution page.
- [x] Distinct Drift convergence page.
- [x] Distinct Configuration Revisions page at canonical `/ha/revisions`.
- [x] Query-backed adjacent details for revisions, deployments, and drift.
- [x] Persistent publish handoff and preview/confirmation before deployment.
- [x] Shared structured semantic diff presentation.
- [x] No canonical HA navigation items render the same page.

## Feature presentation

- [x] Blocked Services catalogue.
- [x] Blocklist table.
- [x] Allowlist table.
- [x] Client table/dialog.
- [x] Rewrite table/dialog.
- [x] DHCP interface discovery.
- [x] Active leases.
- [x] Static lease table/dialog.
- [x] Structured list controls.
- [x] Friendly duration controls.
- [x] Upstream test.
- [x] Cache clear.
- [x] Query-log clear.
- [x] Statistics reset.
- [x] Test-host filtering.

## Quality gates

- [x] Unit tests.
- [x] API contract tests unchanged or deliberately updated.
- [ ] Playwright critical flows.
- [x] Visual regression screenshots.
- [x] Light and dark screenshots.
- [x] Desktop and mobile screenshots.
- [x] Keyboard navigation.
- [x] Accessibility scan.
- [x] No raw colours in feature components.
- [x] No unknown-route Dashboard fallback.
- [x] No TLS secret exposure.
- [x] No DHCP safety regression.
