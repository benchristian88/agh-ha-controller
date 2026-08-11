# Frontend Design

> **Historical foundation.** Release 0.1–0.4 implementation descriptions below
> are retained as design history. Where sidebar, route, or current component
> language conflicts, ADR-0026, `ui-navigation.md`,
> `navigation-and-shell.md`, and the Release 0.4.1 Phase 10 regression report
> are authoritative.

## Design goal

The frontend should feel immediately familiar to an AdGuard Home user while clearly exposing HA concepts that do not exist in a single-node product.

It should be calm, operational, information-dense, and suitable for daily use.

## Release 0.1 implementation

The first implemented surface includes one-time setup, login, cluster creation and selection, a health dashboard, node list/onboarding/edit/test/removal, and an audit table. It uses the project-owned dark tokens, native forms, visible focus, textual status badges, responsive layouts, typed API access, and explicit loading, empty, stale, cached-with-refresh-error, and failure states.

The dashboard does not render zero-value traffic charts before telemetry exists. Release 0.3 exposes configuration plus deployment/drift navigation; statistics and query-log navigation remain absent until those execution paths are implemented.

Release 0.3 implements the configuration authoring form, immutable revision history/actions, reconciliation-policy selector, deployment timeline with per-node outcomes and safe cancellation, and structured drift restore/adopt/maintenance actions. The screens poll durable deployment state every three seconds and preserve explicit loading, empty, error, partial-success, and maintenance states.

## Release 0.4 implementation

Routine AdGuard settings use nested, bookmarkable `/settings/*` pages instead of overloading the HA Configuration page. The application sidebar is their single navigation surface; individual settings pages do not repeat that menu. Every page loads and saves the same typed schema-v2 draft and directs publication/deployment back to Configuration. Forms cover DNS, filter/allowlist authoring and partial-result refresh, persistent clients, rewrites, blocked-service schedules, safety/Safe Search, human-readable retention days, redacted TLS cards, and per-node DHCP/static leases. DHCP node names, client identifiers, and blocked-services schedule labels are headings inside their corresponding cards while hidden fieldset legends preserve form grouping for assistive technology. Patch-level capability notices explain when cache/timeout/filter/rewrite/ignore controls must retain an older node's imported defaults. Selecting an active DHCP node disables other draft overrides in the browser; server validation remains authoritative. Schema-v1 drafts show upgrade/import guidance rather than editable v2 controls.

Release 0.4.1 makes the horizontal header and matching mobile drawer the sole
primary navigation. Phase 9A makes `/settings/general` the canonical presentation for
protection, filtering, safety, Safe Search, and node-local Query Log and
Statistics policy. It uses preset/custom lossless durations, validated domain
rows, explicit patch-capability warnings, and draft/revision/affected-node
context. Saving remains draft-only; central Statistics and Query Log data
surfaces remain assigned to Releases 0.5 and 0.6 respectively.

## Release 0.5 statistics

`/statistics` reuses the shell's persistent cluster/node scope and presents
controller-collected 24-hour, 7-day, and 30-day data. Four summary cards,
accessible SVG activity lines, ranked domain/client/upstream panels, and a
node-attributed coverage table share the existing responsive card/table/status
language. Loading, unavailable, partial, stale, unsupported, maintenance, and
refresh-error states are textual. The dashboard adds only a compact 24-hour
summary and remains primarily a health surface. Its final Release 0.9.1
hierarchy keeps node health in the top summary, presents API/HA
Redundancy/Statistics/Query Log as controller subsystems, and uses Queries,
Blocked percentage, Safety Interventions, and query-weighted Average Processing
for DNS activity. Statistics coverage stays on the full Statistics and
collector-health surfaces.

## Release 0.6 Query Log

`/query-log` reuses persistent cluster/node scope for a dense node-attributed
table, debounced server search, observed status/type filters, exact client
filter, keyset pagination, conservative refresh, and structured inline detail.
Coverage makes stale, unsupported, disabled, failed, and known-gap nodes
explicit. Context actions enter the existing Custom Rules, Rewrites, Clients,
Nodes, and Configuration Control routes and never bypass draft/revision/deploy
separation. Full behavior and responsive states are in `query-log.md`.

The 3 August 2026 HA responsibility pass retains the same navigation but gives
each HA route one task: Nodes for infrastructure, Configuration Control for
forward-looking draft approval/publication and advanced adoption, Deployments
for execution, Drift for current convergence, and Revisions for immutable
revision comparison and rollback. Shared controller APIs and semantic diff
primitives remain implementation reuse, not a reason to render duplicate pages.

The 9 August 2026 revision-lifecycle pass makes `/ha/revisions` canonical and
retains `/ha/history` as a compatibility redirect. Publishing remains on
Configuration Control with a persistent exact-revision handoff. Revisions,
Deployments, and Drift use query-backed adjacent table details; deployment
requires preview and confirmation, and the resulting durable deployment opens
by exact ID. ADR-0027 supersedes ADR-0026 only for this route terminology and
interaction presentation.

## Release 0.2 implementation

`/ha/configuration` provides a read-only inventory for the selected cluster. It models initial loading, empty clusters, collection failures, compatibility warnings, successful semantic equality, detailed section/scope differences, and optimistic import conflicts. Import confirmation explicitly states that no node is changed and that the resulting draft is neither published nor deployable.

## Visual direction

Use an original implementation inspired by AdGuard Home dark mode.

Do not copy source code, trademarks beyond nominative product references, or proprietary assets.

### Theme characteristics

- System, Light, and Dark are browser-local preferences; System is the default
  and follows OS changes.
- Atlas Blue is the primary interaction colour and approved theme-specific
  Atlas artwork is used without CSS inversion. Semantic health, warning, and
  failure colours remain independent.
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
- Operational Status

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
- Collector lag increased or a known ingestion gap was detected.

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
