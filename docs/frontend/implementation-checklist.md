# UI Alignment Implementation Checklist

## Phase 0

- [ ] Create migration branch.
- [ ] Record screenshots of all current routes.
- [ ] Run existing tests.
- [ ] Create route inventory.
- [ ] Catalogue existing reusable components.
- [ ] Add explicit Not Found behaviour.

## Foundation

- [ ] Horizontal header.
- [ ] Settings dropdown.
- [ ] Filters dropdown.
- [ ] HA Controller dropdown.
- [ ] Mobile drawer.
- [ ] Context row.
- [ ] Active revision.
- [ ] Cluster health.
- [ ] Active deployment.
- [ ] Route redirects.
- [ ] Shared page widths.
- [ ] Light/dark tokens.

## Configuration Control

- [ ] Rename to Configuration Control.
- [ ] Remove schema-v1 wording.
- [ ] Remove duplicate narrow editor.
- [ ] Add schema-v2 draft summary.
- [ ] Add links to authoring pages.
- [ ] Preserve validation/publication/history/deploy/rollback.
- [ ] Preserve advanced observation/import.

## Feature presentation

- [x] Blocked Services catalogue.
- [x] Blocklist table.
- [x] Allowlist table.
- [x] Client table/dialog.
- [x] Rewrite table/dialog.
- [x] DHCP interface discovery.
- [x] Active leases.
- [x] Static lease table/dialog.
- [ ] Structured list controls.
- [x] Friendly duration controls.
- [ ] Upstream test.
- [ ] Cache clear.
- [ ] Query-log clear.
- [ ] Statistics reset.
- [ ] Test-host filtering.

## Quality gates

- [x] Unit tests.
- [x] API contract tests unchanged or deliberately updated.
- [ ] Playwright critical flows.
- [ ] Visual regression screenshots.
- [ ] Light and dark screenshots.
- [ ] Desktop and mobile screenshots.
- [x] Keyboard navigation.
- [ ] Accessibility scan.
- [ ] No raw colours in feature components.
- [ ] No unknown-route Dashboard fallback.
- [ ] No TLS secret exposure.
- [x] No DHCP safety regression.
