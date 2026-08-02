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

## Shell

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

- `StatusBadge`
- `NodeBadge`
- `RevisionBadge`
- `ConvergenceSummary`
- `StructuredDiff`
- `ProgressTimeline`
- `PartialSuccessPanel`

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
