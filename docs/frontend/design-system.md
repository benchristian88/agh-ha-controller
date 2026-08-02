# Frontend Design System

## Purpose

This document defines the visual and interaction system for AGH HA Controller.

The design should feel familiar to AdGuard Home users while remaining an original implementation designed for multi-node management, desired-state configuration, revisions, deployments, and drift control.

The application uses:

- Horizontal desktop navigation.
- Responsive mobile navigation.
- A persistent cluster and node context row.
- Semantic light and dark themes.
- Shared form, table, dialog, status, and feedback components.
- Clear separation between Save Draft, Publish Revision, Deploy, Verify, and Reconcile.

---

## Design principles

### Familiar before novel

Routine DNS administration should use familiar AdGuard Home terminology, density, grouping, and control patterns.

### HA context must remain visible

The interface must make these concepts explicit:

- Active cluster.
- Entire Cluster or selected node.
- Active revision.
- Cluster health.
- Active deployment.
- Convergence and drift.

### API types do not dictate UI controls

The AdGuard Home API is a transport contract, not a user-interface specification.

Examples:

- Known service IDs become a searchable service catalogue.
- Filter URLs become a structured table.
- Persistent clients become a table and edit dialog.
- DNS rewrites become a searchable table.
- Durations become friendly duration controls.
- IP and CIDR collections become validated structured lists.
- Custom filter rules remain a specialist text editor because the text itself is the domain representation.

### Preserve the controller lifecycle

The interface must distinguish:

```text
Save Draft
→ Publish Revision
→ Deploy
→ Verify
→ Reconcile
```

Saving a form must never imply that node configuration has already changed.

---

## Application shell

### Desktop header

Use horizontal primary navigation.

```text
Dashboard
Statistics
Settings
Filters
Query Log
HA Controller
Setup Guide
```

Dropdown menus:

```text
Settings
├── General
├── DNS
├── Encryption
├── Clients
└── DHCP
```

```text
Filters
├── DNS Blocklists
├── DNS Allowlists
├── DNS Rewrites
├── Blocked Services
└── Custom Filter Rules
```

```text
HA Controller
├── Nodes
├── Configuration Control
├── Deployments
├── Drift
└── Change History
```

Lower-frequency administration belongs in the user or system menu:

- Users
- Audit Log
- System Settings
- Backups
- About
- Sign Out

### Context row

The context row appears below the main header.

It contains:

- Cluster selector.
- Scope selector.
- Active revision.
- Cluster health.
- Active deployment indicator.

Example:

```text
[Home DNS ▾] [Entire Cluster ▾] Revision 24  ● Healthy
```

### Mobile

Below the desktop breakpoint:

- Replace horizontal navigation with a hamburger menu.
- Use a full-height navigation drawer.
- Preserve the same navigation hierarchy.
- Show Settings, Filters, and HA Controller as expandable groups.
- Keep cluster and scope context visible or accessible through a context sheet.
- Do not invent a separate mobile-only information architecture.

---

## Colour roles

Use semantic tokens rather than raw colours inside feature components.

Required roles:

```css
--page
--page-subtle
--header
--card
--popup
--border
--text
--text-muted
--text-disabled
--input
--input-border
--primary
--primary-hover
--primary-soft
--success
--success-soft
--info
--info-soft
--warning
--warning-soft
--danger
--danger-soft
--neutral-soft
--link
--overlay
--focus
```

### Original dark-theme reference palette

The original project palette remains a valid starting reference:

```css
--bg-app: #111827;
--bg-header: #151f2d;
--bg-card: #1d2939;
--bg-subtle: #162131;
--border: #2d3a4d;
--text: #f1f5f9;
--text-muted: #9fb0c4;
--accent: #25a875;
--accent-soft: #66d9a5;
--info: #60a5fa;
--warning: #f6b85f;
--danger: #f07b7b;
```

These values should be mapped into semantic tokens rather than referenced directly throughout feature CSS.

The implementation source of truth for actual token values is:

```text
web/src/styles/design-tokens.css
```

---

## Status semantics

Use stable labels:

- Healthy
- Degraded
- Unreachable
- Converged
- Drifted
- Pending
- Applying
- Verifying
- Failed
- Maintenance
- Incompatible
- Observed Only
- Unsupported

Status roles:

| Status type | Colour role |
|---|---|
| Healthy, Converged, Success | Green |
| Informational, Observed | Blue |
| Pending, Warning, Drifted | Amber |
| Failed, Blocked, Unreachable | Red |
| Maintenance, Disabled, Unknown | Grey |
| Incompatible | Purple or red |

Colour must never be the only indicator. Use text and iconography as well.

---

## Typography

Recommended font stack:

```css
font-family: "Rubik", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
```

Use the existing application font if changing fonts creates unnecessary migration risk.

### Type scale

| Token | Size | Line height | Use |
|---|---:|---:|---|
| Display | 40px | 48px | Rare onboarding or empty-state headline |
| H1 | 32px | 40px | Page title |
| H2 | 24px | 28px | Major section |
| H3 | 20px | 24px | Card or group heading |
| Body large | 18px | 28px | Introductory copy |
| Body | 16px | 24px | Main copy and controls |
| Body small | 14px | 20px | Tables, labels, metadata |
| Caption | 12px | 16px | Secondary metadata |

Use weights 400, 500, 600, and 700.

Most interface text should use 400 or 500. Avoid excessive heavy bold.

Metric values may use approximately 28–32px.

---

## Spacing

Use a 4px base scale.

Common values:

- 4px: micro spacing.
- 8px: compact gap.
- 12px: control gap.
- 16px: mobile outer padding and compact card padding.
- 20px: settings-row spacing.
- 24px: desktop card padding and major section gap.
- 32px: large section separation.
- 40px and 48px: major layout separation only.

### Layout dimensions

- Main header: approximately 64px.
- Context row: approximately 44–52px.
- Desktop page padding: 24px.
- Mobile page padding: 16px.
- Control radius: 6px.
- Card radius: 8px.
- Dialog radius: 12px.
- Badge radius: full pill.

Prefer dividers over excessive nested cards.

---

## Page width classes

Pages must use one shared width class.

### Narrow

Use for:

- Login.
- Setup steps.
- Focused forms.

### Standard

Use for:

- General settings.
- DNS settings.
- Encryption.
- DHCP configuration.

### Wide

Use for:

- Nodes.
- Clients.
- Filter lists.
- Revisions.
- Deployments.
- Drift.

### Full

Use only where justified:

- Query Log.
- Data-heavy Statistics pages.

Feature pages must not define arbitrary max-width values.

---

## Navigation styling

- Keep top-level labels compact.
- Use a subtle active underline, text treatment, or background.
- Avoid large filled navigation tabs.
- Dropdowns use the semantic popup surface.
- Dropdowns use restrained shadows.
- Active child routes mark the parent menu active.
- Menus must remain inside the viewport.
- Desktop and mobile navigation use the same labels and hierarchy.
- Navigation must be keyboard accessible.

---

## Buttons

### Primary

Use for the single main page action:

- Add Node.
- Save Draft.
- Publish Revision.
- Deploy Revision.

Only one primary action should normally appear in a page header.

### Secondary

Use for:

- Compare.
- Test.
- Refresh.
- Export.
- Cancel.
- View details.

### Danger

Use only for destructive actions:

- Remove Node.
- Delete Draft.
- Clear Query Log.
- Reset Statistics.
- Reset DHCP.
- Revoke Session.

### Ghost or text action

Use for low-frequency contextual actions.

All buttons require:

- Default.
- Hover.
- Active.
- Focus.
- Disabled.
- Loading states.

---

## Forms

### SettingRow

Use for:

```text
Setting title and description              Control
Optional warning or help                   Optional status
```

Desktop uses two columns.

Mobile moves the control below the description.

### SettingsGroup

Use for:

- Related switches.
- Radio selections.
- Small option groups.

### Field

Every field contains:

- Label.
- Control.
- Optional help text.
- Validation message.
- Optional suffix or unit.
- Optional scope indicator.

### Control rules

- Boolean → switch.
- Small enum → radio or segmented control.
- Large enum → select.
- Duration → presets plus custom duration.
- IP or CIDR → validated network field.
- Known ID catalogue → grouped searchable selector.
- Structured list → table or repeatable rows.
- Domain-specific rules → specialist editor.
- Secret → redacted inventory or secret reference.

### Draft state

Settings pages must show:

- Unsaved changes.
- Save Draft status.
- Current active revision.
- Scope.
- Capability warnings.
- Affected nodes.

Saving a draft must not imply deployment.

---

## Tables

Use tables for:

- Nodes.
- Clients.
- Blocklists.
- Allowlists.
- DNS rewrites.
- Static leases.
- Active leases.
- Revisions.
- Deployments.
- Drift.
- Query records.

Table rules:

- Use 14px body text.
- Keep row density compact.
- Use subtle row hover.
- Place actions at the right.
- Include node attribution in cluster views.
- Use text plus icon or badge for status.
- Provide loading, empty, filtered-empty, error, stale, and partial-success states.
- Use horizontal scrolling or structured mobile rows where necessary.
- Do not create unique table styling per feature.

---

## Cards

Use cards only for coherent groups:

- Related settings.
- Dashboard metrics.
- Node status.
- Deployment summary.
- Revision summary.
- Capability or warning panels.

Do not put every individual field into its own card.

---

## Shared components

### Application shell

- AppShell
- AppHeader
- PrimaryNavigation
- NavigationDropdown
- MobileNavigationDrawer
- ContextBar
- ClusterSelector
- ScopeSelector
- ActiveRevisionIndicator
- ActiveDeploymentIndicator
- PageContainer
- PageHeader
- NotFoundPage

### Settings and forms

- SettingRow
- SettingsGroup
- Field
- DurationField
- NetworkListField
- DomainListField
- UrlListField
- OrderedTextEditor
- RuleEditor
- ScopeIndicator
- CapabilityWarning
- SecretField
- UnsavedChangesNotice

### Structured resources

- DataTable
- FilterListTable
- ClientTable
- RewriteTable
- LeaseTable
- ServiceCatalogue
- ServiceGroup
- ServiceToggle
- ScheduleEditor
- TagMultiSelect
- IdentifierListEditor
- UpstreamEditor

### HA display

- HealthBadge
- StatusBadge
- NodeBadge
- NodeStatusCard
- RevisionBadge
- DriftBadge
- MetricCard
- ConvergenceSummary
- StructuredDiff
- DeploymentProgress
- ProgressTimeline
- PartialSuccessPanel

### Feedback and overlays

- Banner
- Toast
- EmptyState
- ErrorState
- LoadingSkeleton
- Dialog
- ConfirmationDialog
- ConfirmDialog
- DeploymentDialog
- DriftResolutionDialog
- OperationalCommandDialog

Feature pages may compose shared components but must not create local replacements for:

- Navigation.
- Buttons.
- Cards.
- Tables.
- Dialogs.
- Settings rows.
- Badges.
- Duration controls.
- Structured list editors.
- Destructive confirmation.

---

## Feature-specific control expectations

### Blocked Services

Use:

- Searchable grouped service catalogue.
- Human-readable names.
- Service toggles or checkboxes.
- Selected count.
- Group actions.
- Schedule editor.
- Compatibility warnings.

Do not use a free-text service-ID field.

### Blocklists and Allowlists

Use:

- Separate tables.
- Enabled state.
- Add/edit dialogs.
- URL validation.
- Refresh selected and refresh all.
- Rule count.
- Last-update metadata.
- Per-node application state.

### Clients

Use:

- Searchable table.
- Add/edit dialog.
- Validated identifiers.
- Tag selector.
- Grouped safety controls.
- Inheritance controls.
- Reusable blocked-service selector.
- Removal confirmation.

### DNS Rewrites

Use:

- Searchable table.
- Validated domain and answer fields.
- Add/edit dialog.
- Delete confirmation.
- Draft and convergence context.

### DHCP

Use:

- Node-specific interface selector.
- Validated network controls.
- Active-DHCP check.
- Active leases table.
- Static leases table and dialogs.
- Explicit one-active-node state.

### Custom Filter Rules

Use:

- Specialist text or code editor.
- Syntax help.
- Validation.
- Test-host action.
- Search.
- Line-level revision comparison.

---

## Feedback hierarchy

Use:

1. Inline validation for field errors.
2. Card-level error for a failed section.
3. Page banner for blocking page errors.
4. Persistent operation panel for deployment or reconciliation failure.
5. Toast for brief non-blocking confirmation.

Do not use a toast as the only record of a deployment failure.

---

## Loading and async operations

For:

- Node checks.
- Imports.
- Validation.
- Deployments.
- Reconciliation.
- Filter refresh.
- Operational commands.

The UI must:

- Show operation started.
- Preserve operation identity.
- Allow safe navigation away.
- Surface completion globally.
- Show per-node results.
- Distinguish partial success.
- Link to persistent details.

---

## Accessibility

- Target WCAG AA contrast.
- Use visible keyboard focus.
- Make dropdowns and navigation keyboard accessible.
- Use native controls or accessible equivalents.
- Trap and return focus in dialogs.
- Move focus to page title after route navigation.
- Move focus to the first invalid field after failed submission.
- Use text labels in addition to colour.
- Provide textual or tabular equivalents for charts.
- Use approximately 44px touch targets where practical.
- Announce long-running operation state changes.

---

## Theme behaviour

- Support light, dark, and system preference.
- Use identical semantic token names in both themes.
- Persist user preference.
- Review charts, tooltips, dialogs, code editors, badges, and tables separately in both themes.
- Avoid neon effects or excessive contrast in dark mode.

---

## Component governance

Every shared component should include:

- A documented purpose.
- Supported variants.
- Loading, disabled, and error states.
- Mobile example.
- Light and dark examples.
- Unit or interaction tests.
- Accessibility review.
- Storybook or equivalent showcase where available.

Existing frontend presentation is not authoritative where it conflicts with the current frontend specification, ADR-0026, or the Release 0.4 implementation audit.
