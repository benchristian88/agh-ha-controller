# Component Catalogue

## Phase 3 implementation

The generic Phase 3 catalogue is implemented under `web/src/components/` and
recorded in `release-0.4.1-phase-3-implementation.md`. Feature-specific tables,
catalogues, selectors, schedules, and deployment/drift dialogs remain assigned
to their later migration phases; they should compose these generic primitives.

Phase 4 adds the reusable `ScheduleEditor` under `web/src/components/` and the
blocked-service `ServiceCatalogue`, `ServiceGroup`, and `ServiceToggle`
composition under `web/src/features/blockedservices/`. The selector consumes
controller presentation metadata and is structured for later Clients reuse;
Clients are not migrated in Phase 4.

Phase 5 establishes the shared `FilterListTable`, filter-list projection, URL
editor, disable-oriented confirmation, per-node results, and refresh-command
composition under `web/src/features/filterlists/`. DNS Blocklists and DNS
Allowlists use that composition through separate route wrappers, desired-state
fields, presentation reads, copy, and API flags.

Phase 6 adds the shared `TagMultiSelect` and composes `DataTable`, `Dialog`,
`ConfirmDialog`, `IdentifierListEditor`, `UpstreamEditor`, the Phase 4
`ServiceCatalogue`, and `ScheduleEditor` under `web/src/features/clients/`.
Persistent Clients use that composition for searchable rows and structured
add/edit/remove draft interactions.

Phase 7 composes `DataTable`, `Dialog`, `ConfirmDialog`, `Field`, `SettingRow`,
`SettingsGroup`, `StatusBadge`, `ConvergenceSummary`, feedback, and
`UnsavedChangesNotice` under `web/src/features/rewrites/`. DNS Rewrites use that
composition for searchable rows, contract-bounded validation and type
inference, capability-aware enablement, and confirmed draft-only deletion.

Phase 8A adds the shared `LeaseTable` and composes it with `Dialog`,
`ConfirmDialog`, `DurationField`, `Field`, `SettingsGroup`, `ScopeIndicator`,
`StatusBadge`, and feedback under `web/src/features/dhcp/`. DHCP uses separate
per-node sections for discovered interfaces, audited active-server checks,
network fields, observed active leases, and draft-managed static leases.

Phase 9A composes `PageContainer`, `PageHeader`, `SettingsGroup`, `SettingRow`,
`DurationField`, `DomainListField`, `ScopeIndicator`, `CapabilityWarning`,
feedback, and `UnsavedChangesNotice` under `web/src/features/general/`.
`DurationField` now optionally supports exact custom-unit multipliers so
millisecond schema values can use friendly units without conversion loss.

Phase 9B composes `UpstreamEditor`, `NetworkListField`, `DurationField`,
`Field`, `SettingRow`, `SettingsGroup`, `ScopeIndicator`, capability feedback,
and draft feedback under `web/src/features/dns/`. DNS resolver lists remain
lossless browser-side inputs; schema-v2 ordered/set canonicalisation remains
authoritative. Cache sizes use exact bytes with binary KiB/MiB presentation,
and DNS TTL/timeout values use exact whole-second duration conversion. Upstream
testing remains excluded until the separate Phase 9C controller command.

Phase 9C-1 composes `OperationalCommandDialog`, `PartialSuccessPanel`, and
`StatusBadge` on DNS Settings for current-draft upstream testing and confirmed
DNS cache clearing. Both commands have explicit selected-node/fleet scope,
durable node-attributed results, and remain outside desired state.

Phase 9C-2 migrates Custom Filter Rules to its specialist `RuleEditor` page and
composes the same operational primitives for host-filtering tests. Hostname,
optional client, optional query type, exact scope, compatibility exclusions,
and node-attributed matched rules remain separate from Save Draft and desired
state.

Phase 9C-3 composes `OperationalCommandDialog`, `PartialSuccessPanel`, and
`StatusBadge` in the General Settings Query Log and Statistics policy groups.
Both destructive commands use typed confirmation, narrow selected-node
defaults, explicit compatible-fleet scope, and durable node-attributed results
without changing the corresponding desired policy.

## Shell

Release 0.9.1 adds `ThemeProvider`, `ThemeControl`, and the shared `AtlasBrand`
renderer. Desktop navigation dropdowns and Administration use one controlled
open-menu state with centralized delayed leave, peer switching, outside click,
keyboard focus movement, and Escape return. Mobile groups are controlled peer
disclosures. Theme and asset behavior is documented in
`theme-brand-and-pwa.md`.

- `AppHeader`
- `PrimaryNavigation`
- `NavigationDropdown`
- `MobileNavigationDrawer`
- `ContextBar`
- `ClusterSelector`
- `ScopeSelector`
- `ActiveRevisionIndicator`
- `ActiveDeploymentIndicator`
- `PageContainer`
- `PageHeader`
- `NotFoundPage`

## Settings

- `SettingRow`
- `SettingsGroup`
- `Field`
- `DurationField`
- `NetworkListField`
- `DomainListField`
- `UrlListField`
- `OrderedTextEditor`
- `RuleEditor`
- `ScopeIndicator`
- `CapabilityWarning`
- `UnsavedChangesNotice`

## Structured resources

- `DataTable`
- `FilterListTable`
- `ClientTable`
- `RewriteTable`
- `LeaseTable`
- `ServiceCatalogue`
- `ServiceGroup`
- `ServiceToggle`
- `ScheduleEditor`
- `TagMultiSelect`
- `IdentifierListEditor`
- `UpstreamEditor`

## HA display

- `MetricCard`
- `StatusBadge`
- `NodeBadge`
- `RevisionBadge`
- `ConvergenceSummary`
- `StructuredDiff`
- `ProgressTimeline`
- `PartialSuccessPanel`

`MetricCard` is the single summary/stat tile for Dashboard, Statistics,
Operational Status, HA Operations, and Node Lifecycle. It owns the primary
surface, label/value gap, optional supporting detail, and responsive wrapping;
feature pages provide content only.

`DataTable` optionally renders one expanded record as an adjacent table row.
Feature code owns the record-specific disclosure button and operational detail;
the shared table owns row adjacency, full-column span, selected styling, and
backward compatibility for non-expandable consumers. Revisions, Deployments,
and Drift combine this with query-backed selection. Large immutable revision
JSON remains a nested, collapsed native disclosure.

## Feedback and overlays

- `Banner`
- `Toast`
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `Dialog`
- `ConfirmDialog`
- `DeploymentDialog`
- `DriftResolutionDialog`
- `OperationalCommandDialog`

## Governance

Feature pages may compose shared components but must not create local replacements for:

- navigation;
- buttons;
- cards;
- tables;
- dialogs;
- settings rows;
- badges;
- duration controls;
- list editors;
- destructive confirmation.
