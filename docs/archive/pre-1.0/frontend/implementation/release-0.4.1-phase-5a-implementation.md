# Release 0.4.1 Phase 5A Implementation Record

## Operator outcome

`/filters/blocklists` is a dedicated cluster authoring and observation page.
Existing desired URL-array values appear as searchable table rows. Operators
can add or edit a portable HTTP/HTTPS URL, enable an observed portable URL,
remove/disable a desired URL with accurate confirmation, inspect draft and
node-application state, view per-node metadata, and run the existing audited
refresh-all command with progress and partial results.

Save Draft changes only the mutable desired document. Publish and Deploy remain
Configuration Control actions. Refresh is an operational command and creates
no configuration revision.

## Architecture boundary

The desired-state and database representation are unchanged:

```text
shared.filtering.filterUrls: string[]
```

Names are not controller-owned in this phase. AdGuard Home reports name,
node-local ID, rule count, last-update time, and enabled state through:

```text
GET /control/filtering/status
```

The browser receives only the sanitised, node-attributed presentation DTO:

```text
GET /api/v1/clusters/{clusterId}/blocklists/presentation
```

Those volatile values are not inserted into observed configuration documents,
desired documents, drafts, revisions, canonical hashes, verification hashes,
or drift comparison. Node URLs, credentials, raw response bodies, and raw
errors do not cross the controller API boundary.

## Reconciliation and removal

Removing or switching off a desired row removes its URL from the mutable draft.
After Save Draft, Publish, and Deploy, the existing reconciler calls
`/control/filtering/set_url` with `enabled: false` for an enabled list that is no
longer desired. It does not call `/control/filtering/remove_url`. Disabled node
entries therefore remain recoverable and may remain visible as observed-only
rows.

Editing a URL is presented as one operator action but retains the existing
effective behavior: add and enable the replacement URL and disable the old URL
where required. The dialog previews that behavior before changing the draft.

## Refresh capability

The existing authenticated, CSRF-protected per-node controller operation and
its requested/terminal audit events are retained. The page fans refresh-all out
to every enabled node outside maintenance and presents pending, successful, and
failed results by node.

The supported AdGuard Home `FilterRefreshRequest` accepts only `whitelist`; it
cannot identify a URL or filter ID. “Refresh selected” is therefore shown as
unavailable with an explanation. No controller endpoint pretends that a fleet-
wide category refresh is a selected-row operation.

## Failure behavior

- Live metadata reads are concurrent per enabled node.
- A successful per-node metadata result is retained only for stale fallback.
- A later node-read failure returns cached metadata as `stale`; a node with no
  cache returns `error` or `unsupported` plus a safe code.
- Mixed names, counters, timestamps, enabled state, and missing-node state are
  preserved in the per-node breakdown rather than collapsed into false
  consensus.
- HTTP/HTTPS URLs containing credentials and non-portable schemes/paths are
  rejected at both the browser interaction and controller validation boundary.

## Tests

Backend tests cover AdGuard metadata decoding, disabled list retention,
portable/local-path classification, UTC timestamps, partial nodes, stale cache
fallback, safe controller serialization, and server-side unsupported URL
validation. Existing writer tests continue to assert enable/disable behavior
and whitelist preservation.

Frontend tests cover URL-array migration, search, add and duplicate/unsupported
validation, edit reconciliation preview, enable/disable and removal semantics,
mixed per-node metadata, refresh-all partial failure, Save Draft isolation,
loading/empty/error/stale/partial presentation, keyboard dialog dismissal,
mobile/desktop widths, and explicit light/dark themes. Existing integration
coverage remains responsible for publish/deploy convergence and direct-node
change drift because their execution paths are unchanged.
