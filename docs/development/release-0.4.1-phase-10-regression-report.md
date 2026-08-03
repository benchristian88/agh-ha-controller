# Release 0.4.1 Phase 10 Regression Report

> **Historical Phase 10 evidence.** The route table below accurately records
> the 2 August 2026 Phase 10 implementation. On 3 August 2026 the combined
> Configuration Control/Change History and Deployments/Drift presentations were
> separated. Use `docs/frontend/ui-navigation.md` and the feature ledger for
> current page ownership; do not rewrite this historical test record.

## Outcome

Phase 10 hardens the completed Release 0.4.1 UI migration without changing the
desired-state schema, API contracts, migrations, deployment semantics, or DNS
request path. Canonical navigation, compatibility redirects, explicit Not
Found behavior, route focus, semantic colours, redacted TLS presentation, and
the packaged version identifier are reconciled at `0.4.1`.

Environment-dependent release gates are reported as unavailable rather than
treated as passing. In particular, this macOS workspace has no Docker CLI,
systemd, PostgreSQL test URL, or supported real AdGuard Home node pair.

## Route and redirect table

| Canonical route | Resolution | Operator surface |
|---|---|---|
| `/` | Implemented | Dashboard |
| `/statistics` | Planned state | Release 0.5; no aggregation claim |
| `/settings/general` | Implemented | General settings and node-local policy |
| `/settings/dns` | Implemented | DNS desired settings and DNS operations |
| `/settings/encryption` | Implemented | Redacted observed TLS inventory only |
| `/settings/clients` | Implemented | Persistent clients |
| `/settings/dhcp` | Implemented | Guarded node-specific DHCP |
| `/filters/blocklists` | Implemented | DNS blocklists |
| `/filters/allowlists` | Implemented | DNS allowlists |
| `/filters/rewrites` | Implemented | DNS rewrites |
| `/filters/blocked-services` | Implemented | Blocked Services catalogue |
| `/filters/custom-rules` | Implemented | Custom filter rules and host test |
| `/query-log` | Planned state | Release 0.6; no ingestion claim |
| `/ha/nodes` | Implemented | Nodes and onboarding |
| `/ha/configuration` | Implemented | Configuration Control lifecycle |
| `/ha/deployments` | Implemented | Combined control plane, deployment focus |
| `/ha/drift` | Implemented | Combined control plane, drift focus |
| `/ha/history` | Implemented | Configuration Control history |
| `/setup-guide` | Planned state | Unscheduled product scope |
| `/system/users` | Planned state | Administration placeholder |
| `/system/audit` | Implemented | Audit Log |
| `/system/settings` | Planned state | Administration placeholder |
| `/system/backups` | Planned state | Administration placeholder |
| `/system/about` | Planned state | Administration placeholder |

Every canonical path has an exact automated resolution assertion. Unknown
paths return the explicit Not Found page. A trailing slash redirects to the
same canonical path without the trailing slash.

| Compatibility route | Redirect target |
|---|---|
| `/settings/filters` | `/filters/blocklists` |
| `/settings/rewrites` | `/filters/rewrites` |
| `/settings/services` | `/filters/blocked-services` |
| `/settings/privacy` | `/settings/general` |
| `/settings/infrastructure` | `/settings/encryption` |
| `/ha/revisions` | `/ha/history` |

Redirects preserve query strings and fragments in the browser. No
compatibility redirect was removed.

## Removed obsolete presentation code

- Removed `web/src/features/settings/ManagedSettingsPage.tsx`. Its broad DNS
  and filtering forms, textarea helpers, duplicated headings, draft save path,
  and capability presentation were superseded by the canonical feature pages.
- Removed `web/src/features/settings/ManagedSettingsPage.test.tsx` and replaced
  its obsolete broad-editor assertion with dedicated Encryption inventory
  coverage.
- Removed the now-unreferenced `features/settings/settings.ts` row-key helper
  and its isolated test; migrated feature editors already own stable keys.
- Moved the routing-only `SettingsArea` type out of the deleted component.
- Removed redundant `.gitkeep` files from populated `components`, `auth`,
  `configuration`, `dashboard`, `nodes`, `lib`, and `styles` directories.
- Removed sidebar-era `--bg-sidebar` naming and remaining raw component colour
  and shadow values from `theme.css`. Raw values remain only where semantic
  tokens are defined in `design-tokens.css` or in non-CSS browser metadata.

There was no remaining old sidebar component, old top-bar component, or
duplicate settings-navigation component to delete at Phase 10 start.
`Primitives.examples.tsx` remains intentionally as a tested component
catalogue. Empty `statistics` and `query-log` feature directories remain as
explicit future-release boundaries.

## Regression results

Validated on 2 August 2026:

| Gate | Result |
|---|---|
| Frontend unit/DOM/WCAG suite | Pass: 191 tests across 32 files |
| TypeScript | Pass |
| Biome | Pass |
| Vite production build | Pass: 74 modules |
| Go full suite | Pass |
| Go race suite, uncached | Pass |
| `go vet ./...` | Pass |
| Controller and migrator production build | Pass, version `0.4.1` |
| Production dependency audit | Pass: zero vulnerabilities |
| systemd installer shell syntax | Pass |
| Diff whitespace check | Pass |
| Frontend direct-node API scan | Pass: no production `/control/` reference |

The Go suites cover authentication, encrypted credentials, node onboarding,
observation/import, optimistic drafts, validation, immutable publication,
sequential deployment, read-back verification, total-success activation,
rollback, drift reconciliation, TLS redaction, DHCP validation/handoff, and
operational commands. The PostgreSQL-backed workflows that join these layers
compiled, but their four cases skipped because `TEST_DATABASE_URL` was not
set.

## Visual regression set

The production frontend was captured against deterministic same-origin
controller fixtures. Exact CSS viewport emulation was used at 320px.

- Not Found, light and dark: 320 × 800.
- Not Found, light and dark: 768 × 900.
- Not Found, light and dark: 1199 × 900.
- Not Found, light and dark: 1200 × 900.
- Not Found, light and dark: 1440 × 1000.
- Mobile drawer hierarchy and Filters/DNS Rewrites active state, dark:
  320 × 800.
- Existing Configuration Control desktop/mobile and shared-primitives captures
  remain part of the Release 0.4.1 set.

The captures are indexed in
`docs/frontend/screenshots/release-0.4.1/README.md`.

## Accessibility results

- Axe structural WCAG 2.0 A/AA and 2.1 AA checks pass for the application
  shell, Not Found state, planned state, and expanded mobile hierarchy.
- Colour contrast is excluded from jsdom because it has no layout/computed
  colour engine. Token pairs were checked separately. Normal text/card is
  13.42:1 light and 12.41:1 dark; muted/card is 4.83:1 light and 7.16:1 dark;
  primary button text is 5.66:1 light and 7.21:1 dark. Semantic foreground/soft
  background pairs are at least 5.57:1 light and 4.61:1 dark.
- Native header dropdowns and the mobile drawer remain keyboard reachable.
  Escape closes the drawer. Dialog tests cover initial focus, focus trapping,
  Escape behavior, and focus return. The Drift route now focuses its own
  section heading; Deployments does the same.
- Loading, empty, error, stale, unsupported, incompatible, and partial-success
  states retain automated feature/shared-component coverage.

## Packaging, migration, and upgrade validation

| Check | Result |
|---|---|
| Native controller/migrator/web build | Pass |
| systemd installer syntax | Pass |
| systemd unit verification/install/restart | Not run: systemd unavailable on macOS |
| Compose configuration/build/clean install | Not run: Docker CLI unavailable |
| Migration checksum/unit coverage | Pass in Go suite |
| PostgreSQL clean install and migration up/down/up | Not run: `TEST_DATABASE_URL` unset |
| Upgrade from Release 0.4 and persistence restart | Not run: Docker/systemd/PostgreSQL reference environment unavailable |
| Real-node write/read-back and DHCP handoff | Not run: controlled two-node environment unavailable |

The packaged defaults in the Makefile, Dockerfile, Compose image/build,
systemd installer, Go runtime, and web package now agree on `0.4.1`. No schema
change was added in Phase 10; the released append-only migrations are
unchanged.

## Security and architecture review

- Browser production code has no direct AdGuard Home `/control/` call.
- TLS certificate chains, private keys, and paths still have no frontend/domain
  representation. The dedicated Encryption page is read-only.
- No logging, credential, authentication, CSRF, or API boundary changed.
- Save Draft remains separate from Publish and Deploy.
- Sequential stop-on-failure, read-back verification, active-only-after-total-
  success, drift policies, and DHCP handoff ordering are unchanged.
- The controller remains outside the live DNS path. The automated process-
  independence regression remains; a packaged live-DNS outage exercise was not
  available in this workspace.

## Documentation changes

- `README.md` and `web/README.md`: current status, navigation, lifecycle,
  screenshots, version, and explicit Statistics/Query Log boundaries.
- `docs/product/feature-ledger.md`, `CHANGELOG.md`,
  `docs/roadmap/release-0.4.1-ui-alignment-roadmap.md`,
  `docs/roadmap/roadmap.md`, and `docs/roadmap/release-plan.md`: Phase 10
  classification, evidence, and remaining external gates.
- `docs/development/testing.md`, `docs/development/release-process.md`,
  `tests/README.md`, and this report: exact test, packaging, migration, and
  upgrade status.
- `docs/frontend/ui-navigation.md`, `navigation-and-shell.md`,
  `source-of-truth-order.md`, `implementation-checklist.md`, screenshot index,
  and screen-migration specification: current navigation and quality status.
- `docs/frontend/release-0.4-ui-implementation-audit.md` and
  `frontend-design.md`: clearly marked historical where their sidebar-era
  presentation conflicts with the implemented authority.
- `scripts/README.md`: Release 0.4.1 systemd installer version.

## Known issues and deferred items

- Statistics aggregation is not implemented; Release 0.5 owns it.
- Combined Query Log ingestion/search is not implemented; Release 0.6 owns it.
- Setup Guide and most administration routes intentionally show planned states.
- Browser baselines are representative rather than one capture per authenticated
  feature route. Playwright critical-flow automation and a full per-route
  screenshot catalogue remain open checklist items; feature interactions are
  currently covered by DOM tests and deterministic production-build captures.
- The selected-node context is global presentation context; feature pages that
  need explicit mutation scope continue to require their own safe target
  controls.
- Docker, systemd, PostgreSQL upgrade/clean-install, restart persistence,
  supported real-node read/write, controlled DHCP handoff/reset, live log
  redaction, and live DNS-outage checks remain external release gates.
- TLS mutation remains deferred pending controller-managed secret references.

## Cleanup rollback

If a packaged regression is found, restore the removed broad settings file only
as a temporary presentation fallback and route Encryption back to its
inventory branch. Do not revert or edit migrations, desired-state documents,
API contracts, compatibility redirects, deployment logic, TLS redaction, or
DHCP safety. Token changes and route-focus wiring can be reverted independently
and must be followed by route/shell tests, the full frontend suite/build, and
the Go race suite.
