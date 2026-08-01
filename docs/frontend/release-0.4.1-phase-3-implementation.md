# Release 0.4.1 Phase 3 Implementation Record

## Outcome

Phase 3 adds the shared presentation layer required by later feature
migrations. It does not migrate Blocked Services, filter subscriptions,
clients, rewrites, or DHCP and does not add controller or AdGuard Home API
coverage.

## Architecture boundary

- All structured editors are controlled React components. They emit local
  values through `onChange` and never read or write the controller API.
- Save Draft, optimistic concurrency, immutable publication, deployment,
  verification, drift, TLS redaction, and DHCP safety remain unchanged.
- Components use presentation models rather than feature API DTOs.
- Audit Log and Not Found are the only proving consumers. Their existing data
  and route contracts are unchanged.

No domain entity, database record, migration, API endpoint, or AdGuard Home
adapter changed in this phase.

## Implemented modules

| Module | Public primitives |
|---|---|
| `components/Page.tsx` | `PageContainer`, `PageHeader` |
| `components/Settings.tsx` | `SettingRow`, `SettingsGroup`, `Field`, `ScopeIndicator`, `CapabilityWarning`, `UnsavedChangesNotice` |
| `components/StructuredInputs.tsx` | `DurationField`, `NetworkListField`, `DomainListField`, `UrlListField`, `IdentifierListEditor`, `OrderedTextEditor`, `RuleEditor`, `UpstreamEditor` |
| `components/DataDisplay.tsx` | `DataTable`, `Pagination`, `NodeBadge`, `RevisionBadge`, `ConvergenceSummary`, `StructuredDiff`, `ProgressTimeline`, `PartialSuccessPanel` |
| `components/Feedback.tsx` | `Banner`, `Toast`, `LoadingSkeleton`, `EmptyState`, `ErrorState`, compatibility `Loading` |
| `components/Overlays.tsx` | `Dialog`, `ConfirmDialog`, `OperationalCommandDialog` |
| `components/StatusBadge.tsx` | Semantic `StatusBadge` with backward-compatible health states |

`Primitives.examples.tsx` is the Storybook-equivalent showcase available to
visual tooling. It covers light and dark themes, desktop and mobile widths,
loading, empty, error, stale, unsupported, and partial-success states. It is
not exposed as a production route.

## Public interaction rules

- Page width uses only `narrow`, `standard`, `wide`, or `full`.
- Structured editors receive `value` and `onChange`; validation stays local and
  save behavior stays with the parent feature.
- `DurationField` uses values in a caller-declared base unit and combines
  friendly presets with a custom numeric value.
- `DataTable<Row>` receives columns, rows, and a stable row-key function and
  owns common loading, empty, filtered-empty, error, and stale presentation.
- Dialogs are controlled by `open` and `onClose`, trap focus, close with Escape
  when dismissible, and restore focus to the opener.
- Operational commands require an explicit target scope and state that they do
  not mutate the configuration draft.

## Theme and responsive behavior

`design-tokens.css` remains the value source of truth. `theme.css` maps legacy
variables to those semantic tokens so existing pages remain functional during
incremental migration. Explicit light and dark themes and system dark
preference use the same token names. Settings rows, list editors, differences,
summaries, feedback, and dialogs collapse for mobile layouts.

## Failure behavior

- Invalid structured entries remain visible with row-level errors and are not
  silently removed.
- Unsupported inputs are disabled and explain the capability boundary.
- Stale data is visibly labelled.
- Partial operations retain per-target results and an optional persistent
  details link.
- Dialog cancellation performs no mutation and returns keyboard focus.

## Tests and dependencies

DOM interaction coverage uses development-only dependencies:

- `@testing-library/react`;
- `@testing-library/user-event`;
- `jsdom` 26, pinned for the repository's Node 18 test baseline.

Tests cover every Phase 3 primitive, validation for duration/network/domain/URL
and identifiers, list-editor keyboard behavior, dialog focus trap and return,
typed confirmations, state variants, theme/viewport examples, and the rule that
controlled input changes do not submit their parent form.
