# Component Catalogue

## Phase 3 implementation

The generic Phase 3 catalogue is implemented under `web/src/components/` and
recorded in `release-0.4.1-phase-3-implementation.md`. Feature-specific tables,
catalogues, selectors, schedules, and deployment/drift dialogs remain assigned
to their later migration phases; they should compose these generic primitives.

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
