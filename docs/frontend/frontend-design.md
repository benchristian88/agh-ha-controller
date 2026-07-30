# Frontend Design

## Design goal

The frontend should feel immediately familiar to an AdGuard Home user while clearly exposing HA concepts that do not exist in a single-node product.

It should be calm, operational, information-dense, and suitable for daily use.

## Release 0.1 implementation

The first implemented surface includes one-time setup, login, cluster creation and selection, a health dashboard, node list/onboarding/edit/test/removal, and an audit table. It uses the project-owned dark tokens, native forms, visible focus, textual status badges, responsive layouts, typed API access, and explicit loading, empty, stale, cached-with-refresh-error, and failure states.

The dashboard does not render zero-value traffic charts before telemetry exists. Release 0.3 exposes configuration plus deployment/drift navigation; statistics and query-log navigation remain absent until those execution paths are implemented.

Release 0.3 implements the configuration authoring form, immutable revision history/actions, reconciliation-policy selector, deployment timeline with per-node outcomes and safe cancellation, and structured drift restore/adopt/maintenance actions. The screens poll durable deployment state every three seconds and preserve explicit loading, empty, error, partial-success, and maintenance states.

## Release 0.4 implementation

Routine AdGuard settings use nested, bookmarkable `/settings/*` pages instead of overloading the HA Configuration page. The application sidebar is their single navigation surface; individual settings pages do not repeat that menu. Every page loads and saves the same typed schema-v2 draft and directs publication/deployment back to Configuration. Forms cover DNS, filter/allowlist authoring and partial-result refresh, persistent clients, rewrites, blocked-service schedules, safety/Safe Search, human-readable retention days, redacted TLS cards, and per-node DHCP/static leases. DHCP node names, client identifiers, and blocked-services schedule labels are headings inside their corresponding cards while hidden fieldset legends preserve form grouping for assistive technology. Patch-level capability notices explain when cache/timeout/filter/rewrite/ignore controls must retain an older node's imported defaults. Selecting an active DHCP node disables other draft overrides in the browser; server validation remains authoritative. Schema-v1 drafts show upgrade/import guidance rather than editable v2 controls.

## Release 0.2 implementation

`/ha/configuration` provides a read-only inventory for the selected cluster. It models initial loading, empty clusters, collection failures, compatibility warnings, successful semantic equality, detailed section/scope differences, and optimistic import conflicts. Import confirmation explicitly states that no node is changed and that the resulting draft is neither published nor deployable.

## Visual direction

Use an original implementation inspired by AdGuard Home dark mode.

Do not copy source code, trademarks beyond nominative product references, or proprietary assets.

### Theme characteristics

- Dark blue-grey application background.
- Slightly lighter sidebar and cards.
- Green primary action and healthy-state accent.
- Blue for informational state.
- Amber for warning or pending state.
- Red for failure or blocked state.
- Low-contrast borders.
- Moderate corner radius.
- Minimal shadow.
- Clear typography.
- Compact but accessible controls.

## Navigation

### AdGuard Home functions

- Dashboard
- Query log
- Statistics
- DNS settings
- Filters
- Clients
- DNS rewrites

### HA management

- Nodes
- Configuration
- Change history
- Deployments
- Drift
- Log forwarders

### System

- Users
- Audit log
- Settings
- About

## Global controls

The header should contain:

- Current cluster.
- Current scope:
  - Entire cluster.
  - A specific node.
- Cluster health.
- Logged-in user.
- Optional active deployment indicator.

## Dashboard

### Metric cards

- DNS queries.
- Blocked queries.
- Average processing time.
- Active revision.
- Healthy nodes.
- Drifted nodes.
- Ingestion lag.

### Cluster traffic

Show combined trend with optional per-node series.

### Node status

For each node:

- Name.
- Address.
- Version.
- Health.
- Traffic share.
- Latency.
- Applied revision.
- Drift status.
- Last seen.

### Recent activity

- Revision created.
- Deployment started.
- Deployment succeeded or failed.
- Drift detected.
- Drift corrected.
- Node became unreachable.
- Forwarder lag increased.

### Query log preview

Include a node column.

## Configuration experience

Configuration pages should separate:

- Shared cluster settings.
- Node overrides.
- Unsupported settings.
- Observed-only settings.

Every save creates a draft update. Publishing creates a revision.

Before deployment, show:

- Summary of changes.
- Affected nodes.
- Compatibility warnings.
- Restart requirements.
- Node-specific effective values.

## Change history

Revision list:

- Revision number.
- Created time.
- Author.
- Summary.
- Deployment status.
- Active or historical state.

Comparison view:

- Previous value.
- New value.
- Scope.
- Affected nodes.
- Secret values redacted.
- Semantic explanation where possible.

## Drift page

Each drift record should show:

- Node.
- Detection time.
- Changed section.
- Desired value.
- Observed value.
- Policy.
- Resolution.
- Related audit event.

Actions:

- Restore desired state.
- Adopt change into draft.
- Ignore field.
- Put node into maintenance.

## Responsive behaviour

Desktop is the primary administration surface.

At narrow widths:

- Sidebar becomes a drawer.
- Metric cards wrap.
- Tables reduce secondary columns.
- Detail panels stack.
- Critical node health remains visible.
- Complex configuration diffs may use a focused full-screen view.

## Accessibility

- WCAG AA contrast target.
- Keyboard navigation.
- Visible focus states.
- Native controls where possible.
- Text labels in addition to colour.
- Status announcements for deployment progress.
- No critical information conveyed by charts alone.
