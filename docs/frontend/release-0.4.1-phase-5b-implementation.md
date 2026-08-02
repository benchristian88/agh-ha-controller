# Release 0.4.1 Phase 5B Implementation Record

## Operator outcome

`/filters/allowlists` is a dedicated cluster authoring and observation page.
Existing `shared.filtering.whitelistUrls` values appear as searchable table
rows. Operators can add, edit, enable, or remove an allowlist in the mutable
draft; inspect node-reported names, rule counts, update times, and application
state; view per-node results; and run the audited allowlist refresh command with
partial node outcomes.

The page composes the same `FilterListTable`, projection, dialogs, badges,
feedback, and lifecycle controls as DNS Blocklists. The routes, desired arrays,
copy, presentation reads, refresh flags, and reconciliation categories remain
distinct.

## Architecture and data boundary

The desired representation and database schema are unchanged:

```text
shared.filtering.filterUrls: string[]
shared.filtering.whitelistUrls: string[]
```

The allowlist presentation route reads `GET /control/filtering/status` through
the controller and accepts both `whitelist_filters` and legacy `filters`
entries marked with `whitelist: true`:

```text
GET /api/v1/clusters/{clusterId}/allowlists/presentation
```

Node-local IDs, names, enabled state, rule counts, timestamps, fetch freshness,
and safe errors are volatile presentation metadata. They never enter observed
configuration documents, desired drafts, immutable revisions, canonical or
verification hashes, or drift comparison. Category-specific cache keys prevent
blocklist and allowlist metadata from crossing.

## Lifecycle and failure behavior

- Save Draft updates only `whitelistUrls`; Publish and Deploy remain
  Configuration Control actions.
- Deployment retains the existing `add_url` and `set_url` calls with
  `whitelist: true`; blocklists continue to use `false`.
- Removing or disabling a desired row removes its URL from the draft. A later
  deployment disables the node entry and does not delete it.
- Refresh sends `whitelist: true` through the authenticated, CSRF-protected
  controller operation and records requested plus terminal audit events per
  node.
- The AdGuard refresh request cannot target a URL or filter ID. Refresh Selected
  is therefore visibly unavailable with an explanation; Refresh All is the
  functional audited category operation.
- Current reads run concurrently. Failed reads use a matching cached value as
  stale fallback or return a safe error/unsupported result without exposing
  node addresses, credentials, raw errors, or response bodies.

## Tests

Backend tests cover category decoding, volatile metadata preservation,
category-separated caching, sanitized controller output, allowlist refresh and
reconciliation flags, disable behavior, and cross-contamination prevention.
Frontend tests cover existing-array migration, add/edit/enable/disable/remove,
portable URL validation, observed-only metadata, mixed multi-node state,
per-node results, audited refresh partial outcomes, selected-refresh capability
copy, draft/publish/deploy separation, loading/empty/error/stale/partial states,
keyboard dismissal, mobile/desktop widths, and light/dark themes. Existing
integration coverage continues to prove publication, multi-node convergence,
verification, and drift because those execution paths are unchanged.
