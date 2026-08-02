# Release 0.4.1 Phase 8A Implementation Record

## Operator outcome

`/settings/dhcp` now presents DHCP as node-specific desired and observed state.
The cluster summary names the designated node, reports currently observed
active nodes, warns about the one-active boundary, and explains a planned
disable-before-enable handoff. Each enabled node then has its own interface,
preflight, network, active-lease, and static-lease sections.

## Architecture boundary

Phase 8A retains the schema-v2 node override as the only DHCP desired state.
Interface metadata is a volatile controller read and active leases remain in
the latest immutable observation only. Neither enters a draft, revision,
canonical hash, verification hash, or managed drift comparison.

```text
Interface discovery / active check
  -> node-specific controller API
  -> bounded authenticated AdGuard request
  -> sanitized presentation DTO / audit event

DHCP edit
  -> local desired-state draft
  -> Save Draft
  -> Publish Revision
  -> disable-before-enable Deploy
  -> read-back verification and drift detection
```

There is no DHCP reset, lease reset, RA, SLAAC, schema, migration, or direct
browser-to-node operation in this phase.

## Interface and safety tools

`GET /api/v1/nodes/{nodeId}/dhcp/interfaces` translates the reviewed AdGuard
`GET /control/dhcp/interfaces` contract to safe camelCase metadata. Available
interfaces can be selected; unavailable interfaces remain visible; and an
imported interface that is absent or cannot be rediscovered remains selected
with a warning.

`POST /api/v1/nodes/{nodeId}/dhcp/active-check` accepts an explicit interface
and translates the reviewed AdGuard `/control/dhcp/find_active_dhcp` response
to none, found, multiple, partial, or error. The request is non-mutating, never
updates desired state automatically, requires the normal authenticated/CSRF
boundary, rejects maintenance nodes, and records requested plus terminal audit
events. Raw AdGuard error text is discarded.

## Network and lease presentation

- IPv4 gateway, contiguous netmask, range ordering, and subnet containment are
  validated inline; controller validation remains authoritative.
- IPv4 and the already-modelled IPv6 duration use `DurationField` hours while
  retaining integer seconds in the desired document.
- IPv6 exposes only range start and lease duration already present in schema v2.
- `LeaseTable` renders active leases with hostname/client, address, MAC, node,
  expiry, observation time, and freshness.
- The same shared table renders static leases with focused add/edit dialogs,
  MAC/IP/hostname and duplicate validation, and confirmed draft-only removal.
  Copy explains that an edit may reconcile as verified remove-then-add.

## Safety and failure behavior

- Selecting a new designated node clears the prior browser designation;
  server-side at-most-one validation remains authoritative.
- Deployment preview still orders desired-disabled nodes before the desired
  active node, and sequential deployment still stops on failure.
- Discovery has explicit loading, empty, unavailable, malformed, and retry
  states without deleting legacy desired values.
- Active checks expose protocol-partial outcomes and safe controller failures;
  they do not publish, deploy, or perform another operation.
- Save Draft remains separate from Publish and Deploy.

## Tests

Go coverage includes exact upstream shapes and methods, interface discovery,
unavailable endpoints, active-check success/none/multiple/partial/timeout,
sanitized errors, audit records, maintenance rejection, controller auth/CSRF,
static-lease validation, observed-lease drift exclusion, one-active validation,
and disable-before-enable preview ordering.

Frontend coverage includes legacy interface preservation, discovery failure and
empty state, active-check none/partial results, active lease attribution and
freshness, IPv4 validation, duration conversion, static add/edit/confirmed
remove, one-designation handoff, loading/error/stale states, light/dark themes,
desktop/mobile widths, and keyboard dialog behavior. The authoritative
two-node deployment/drift integration workflow remains green when its
PostgreSQL environment is available; a controlled real-network DHCP handoff is
still a release gate.
