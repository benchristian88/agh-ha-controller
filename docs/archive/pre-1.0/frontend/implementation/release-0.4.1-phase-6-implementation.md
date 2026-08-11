# Release 0.4.1 Phase 6 Implementation Record

## Operator outcome

`/settings/clients` now presents persistent clients as a searchable summary
table rather than stacked inline cards. Operators can search desired clients by
name, identifier, or tag, then add or edit one client in a focused dialog.
Removal requires confirmation and remains visibly pending in the draft until
the operator separately saves, publishes, and deploys it.

The table summarises identity, tags, inherited or overridden policy, safety
overrides, client-specific blocked-service count, node compatibility, and local
draft change state. Loading, empty, filtered-empty, error, unsupported-draft,
partial-catalogue, and unavailable-catalogue states are explicit.

## Architecture boundary

Phase 6 is presentation-only. It does not change the schema-v2
`shared.clients` model, database records, controller API, immutable revision
lifecycle, or AdGuard Home reconciliation:

```text
Edit dialog
  -> local desired-state draft
  -> Save Draft
  -> Publish Revision in Configuration Control
  -> Deploy
  -> /control/clients/add|update|delete
  -> read-back verification and drift detection
```

The browser calls only controller APIs. Runtime/auto clients,
`/control/clients/search`, and access-list operations remain out of scope and
are not represented as implemented.

## DTO and validation behavior

The existing camelCase desired-state client maps unchanged to the AdGuard Home
snake_case client payload. In particular:

- positive **Include in query log** maps to inverse `ignoreQueryLog` and then
  `ignore_querylog`;
- positive **Include in statistics** maps to inverse `ignoreStatistics` and
  then `ignore_statistics`;
- `duckDuckGo` and `youTube` retain the established provider mapping;
- client upstream order is retained;
- names, identifiers, tags, blocked-service IDs, schedules, and cache bytes use
  the existing desired-state fields.

The dialog adds advisory IP, CIDR, MAC, ClientID, and AdGuard upstream syntax
feedback. It also reports case-insensitive duplicate client names and
identifiers before committing the dialog. Controller and AdGuard Home
validation remain authoritative. The Update Draft/Add to Draft action is
disabled while dialog validation fails.

## Metadata and preservation

There is no controller or node tag-catalogue metadata operation in Release
0.4.1. `TagMultiSelect` therefore derives suggestions from tags already in the
current draft and accepts free-entry values. Existing and unknown legacy tags
remain selected unless the operator explicitly removes them.

Per-client blocked services reuse the Phase 4 `ServiceCatalogue` and the shared
`ScheduleEditor`. Unknown legacy service IDs use the catalogue's retained-ID
presentation and are never silently discarded. When catalogue metadata is
partial or unavailable, the rest of the client remains editable and existing
IDs remain visible.

## Reused components

- Phase 3: `DataTable`, `Dialog`, `ConfirmDialog`, `IdentifierListEditor`,
  `UpstreamEditor`, `SettingsGroup`, `SettingRow`, feedback, page, and status
  primitives.
- Phase 4: `ServiceCatalogue` and `ScheduleEditor`.
- Phase 6 adds the shared `TagMultiSelect` and human-readable bytes/KiB/MiB
  client cache control.

The removed stacked-card editor no longer exists on the client execution path.

## Failure and compatibility behavior

- Core inventory failure renders a retryable page error.
- Blocked-service catalogue failure is partial: client identity and other
  policy remain editable while selected IDs are preserved.
- Missing client capability, Ecosia provider incompatibility, and selected
  service incompatibility are reflected per row. Publication preflight remains
  authoritative.
- Dialog confirmation never calls publication, deployment, or a node API.
- Removal confirmation states that nodes are unchanged until Save Draft,
  publication, and deployment complete.

## Tests

Frontend tests cover existing-card-to-row data projection, name/identifier/tag
search, add, edit, removal confirmation, draft-only API semantics, unique names,
cross-client identifiers, IP/IPv6/CIDR/MAC/ClientID forms, legacy tags and
service IDs, inheritance, Safe Search providers, inverse log/stat mappings,
Phase 4 selector reuse, upstream order and syntax, cache conversion, loading,
empty, filtered, error, catalogue-unavailable/partial presentation, desktop,
mobile, explicit light/dark themes, and keyboard dialog dismissal.

Existing backend adapter, control-plane, integration, verification, and drift
tests continue to cover add/update/delete reconciliation, publish/deploy
read-back convergence, and direct node changes. Phase 6 does not replace or
bypass those paths.
