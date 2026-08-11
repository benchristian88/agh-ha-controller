# Release 0.4.1 Phase 9A Implementation Record

## Operator outcome

`/settings/general` is the canonical cluster authoring page for protection,
filtering, safety services, Safe Search, node-local Query Log policy, and
node-local Statistics policy.

The page presents four coherent groups, friendly preset/custom durations,
validated ignored-domain rows, human-readable Safe Search providers, and the
current draft, active revision, affected-node, and capability context. The
Statistics ignored-domain enable switch is colocated with its Statistics list.
The page uses the full available content width, consistent with other migrated
Settings pages.

Save Draft is the only write action. Publication, deployment, read-back
verification, and drift handling remain separate HA Controller workflows.
Clear Query Log and Reset Statistics were deliberately excluded from Phase 9A
and are implemented separately as audited destructive commands in Phase 9C-3.

## Architecture boundary

The schema-v2 document and controller APIs are unchanged. The page edits only:

```text
shared.dns.protectionEnabled
shared.filtering.enabled
shared.filtering.updateIntervalHours
shared.services.safeBrowsing
shared.services.parentalControl
shared.services.safeSearch
shared.queryLog
shared.statistics
```

The browser continues to call configuration inventory, nodes, revisions, and
the optimistic configuration-draft update endpoint. It does not call AdGuard
Home directly. Existing version-aware deployment, all-node preflight,
read-back verification, active-revision rules, and drift semantics are
unchanged. Provider availability and capability metadata remain presentation
inputs and do not enter desired or drift hashes.

## Duration and domain behavior

- Filter updates retain integer schema hours and offer the existing common
  values as presets plus Custom.
- Query Log and Statistics retain integer schema milliseconds.
- Policy presets map to exact millisecond constants.
- Custom policy values use the largest exact unit among days, hours, minutes,
  and seconds; milliseconds are the lossless fallback for unusual imported
  values.
- Rendering or changing the displayed custom unit does not mutate the desired
  value. A value changes only when its numeric control changes.
- Invalid, fractional-millisecond, and out-of-range durations block Save Draft.
- `DomainListField` keeps invalid imported or edited rows visible, reports the
  error inline, and blocks Save Draft until corrected.

## Capability and future-release copy

- Arbitrary filter intervals identify nodes lacking
  `filter_interval_arbitrary`.
- Ecosia is retained but disabled when any affected node lacks
  `safe_search_ecosia`.
- Ignored-list switch differences identify nodes lacking
  `ignored_lists_toggle`; desired lists remain preserved.
- Query Log copy explicitly describes node-local policy and assigns the
  combined node-attributed log to Release 0.6.
- Statistics copy explicitly describes node-local retention and assigns
  cluster aggregation to Release 0.5.

## Route migration

`/settings/privacy` continues to redirect to `/settings/general`. Protection is
removed from the DNS form, and filtering enable/update controls are removed
from the broad Custom Filter Rules form after route and component migration
tests established the canonical owner. No duplicate editable controls remain.

## Tests

Frontend tests cover existing-value loading, presets, custom and unknown
duration preservation, duration bounds, inline domains, Statistics switch
mapping, Safe Search providers and patch differences, future-release copy,
draft/revision/node context, Save-Draft-only behavior, keyboard interaction,
theme/mobile-safe shared layout, loading, retryable error, missing draft, route
redirects, and removal of superseded controls.

Existing backend and integration tests remain the authority for publication,
durable deployment, node writes, read-back verification, active revision, and
drift behavior because Phase 9A adds no backend contract or node operation.
