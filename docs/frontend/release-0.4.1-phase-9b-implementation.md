# Release 0.4.1 Phase 9B implementation

Phase 9B migrates `/settings/dns` from the broad legacy settings form to a
dedicated DNS desired-state presentation. It does not change schema v2, the
AdGuard adapter, capabilities, publication, deployment, verification, or drift
behavior.

## Operator outcome

- Primary, bootstrap, fallback, and private reverse resolvers use the shared
  specialist upstream editor with syntax help and conservative line diagnostics.
- Upstream and blocking strategies retain unknown imported values until the
  operator deliberately chooses a supported option.
- Rate-limit exemptions use the shared validated network-list field.
- Custom blocking and ECS address fields are conditional and validated inline;
  hidden desired values are retained.
- Cache sizes use exact byte-backed binary units. TTL and timeout values use
  exact whole-second duration controls.
- Scope, draft version, active revision, affected nodes, unsaved state, and
  node-attributed capability differences remain visible.
- The page uses the full available content width, consistent with Clients and
  other migrated Settings pages.
- The UI uses “Disable IPv6 answers”, matching the actual resolver behavior.

## Collection semantics

Schema-v2 canonicalisation remains unchanged. Primary upstreams and fallback
resolvers are ordered. Bootstrap resolvers, private reverse resolvers, and the
rate-limit allowlist are set-like. Every resolver editor preserves entered order
and text while it is in browser state; normal Save Draft canonicalisation remains
the source of truth for hashes and comparisons.

## Boundaries and failure behavior

Save Draft remains an optimistic controller API update. Publish, deploy,
read-back verification, and drift reconciliation remain separate HA workflows.
Inline presentation errors prevent draft save and remain visible at the field;
server validation issues remain visible after save. Missing cache-toggle and
upstream-timeout capabilities keep their existing preflight/fallback behavior.

No serve-stale, bogus-NXDOMAIN, access-list, cache-clear, or upstream-test API
work is included. The disabled upstream-test control explicitly identifies the
Phase 9C dependency and performs no operation.
