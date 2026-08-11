# Release 0.4.1 Phase 7 Implementation

## Outcome

DNS Rewrites at `/filters/rewrites` now use a searchable desired-state table
with focused add/edit dialogs, inline contract validation, inferred answer
types, confirmed draft-only deletion, capability-aware enablement, draft change
state, and node convergence context.

The page composes the shared Release 0.4.1 `DataTable`, `Dialog`,
`ConfirmDialog`, `Field`, `SettingRow`, `SettingsGroup`, `StatusBadge`, feedback,
page, convergence, and unsaved-change primitives. The Release 0.4 inline row
editor has been removed.

## Supported forms

Phase 7 remains within the reviewed AdGuard Home v0.107.53–v0.107.78 legacy
rewrite contract:

- an exact ASCII hostname or one leading `*.` wildcard domain;
- an IPv4 answer, inferred as A;
- an IPv6 answer, inferred as AAAA;
- a hostname answer, inferred as CNAME;
- an answer equal to the exact domain, shown as a CNAME exception;
- exact uppercase `A` or `AAAA` passthrough values.

The presentation does not accept custom `$dnsrewrite` rule syntax, response
codes, CIDRs, URLs, ports, or additional DNS record types. Custom filter rules
remain the separate domain representation for supported specialist rule text.

## Architecture and failure behavior

- `shared.rewritesEnabled` and `shared.rewrites` retain their schema-v2 shapes.
- Browser calls still save only through the optimistic controller draft API.
- Add, update, delete, sequential deployment, read-back verification, and drift
  reconciliation remain adapter/control-plane responsibilities.
- Delete first removes a row from browser draft state, then requires Save Draft,
  Publish Revision, and Deploy before a node is changed.
- Global and per-entry enablement are editable only when every enabled target
  confirms `rewrite_toggle`; older nodes retain imported values and are named in
  the capability warning.
- Initial load failures are retryable, save failures retain the current browser
  draft, schema-v1 drafts are unsupported, and missing/partial capability data
  cannot silently enable toggle controls.
- No import/export behavior or controller/AdGuard API operation was added.

## Validation and type inference

Dialog validation trims only surrounding whitespace on commit, enforces DNS
label and wildcard placement constraints, accepts only the supported answer
forms, and prevents case-insensitive duplicate domain/answer pairs. Invalid
fields remain next to their diagnostic and the dialog commit action stays
disabled.

The table and dialog infer A, AAAA, CNAME, CNAME exception, A passthrough, or
AAAA passthrough from the unchanged domain and answer strings. Inference is
presentation metadata and does not add a record-type field to desired state.

## Tests

Frontend model and interaction coverage includes:

- migration of existing rewrite entries into rows;
- domain/answer search and filtered-empty recovery;
- valid IPv4, IPv6, CNAME, CNAME-exception, and passthrough forms;
- invalid domain/wildcard and answer rejection;
- duplicate-pair detection during add and edit;
- edit and draft change-state presentation;
- confirmed draft-only delete and later Save Draft payload;
- older-node capability warning and disabled enablement controls;
- loading, empty, retryable error, unsupported, partial, converged, and drifted
  states;
- desktop/mobile widths, light/dark themes, initial dialog focus, Escape close,
  and focus restoration provided by the shared dialog.

The two-node integration fixture now carries A and CNAME rewrites through
deployment and verification snapshots, mutates a rewrite directly on one node,
detects the resulting drift, and verifies enforced reconciliation restores the
desired pair. The PostgreSQL-backed integration test remains environment-gated
by `TEST_DATABASE_URL`.
