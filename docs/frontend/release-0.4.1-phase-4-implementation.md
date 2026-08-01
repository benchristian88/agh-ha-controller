# Release 0.4.1 Phase 4 Implementation Record

## Operator outcome

`/filters/blocked-services` is a dedicated cluster authoring page. Operators
select human-readable services from a searchable grouped catalogue, retain the
existing seven-day inactivity schedule, and save only the mutable draft.
Publication and deployment remain Configuration Control actions.

Existing raw IDs load as selected entries. IDs absent from every available
catalogue remain visible under **Unknown or unsupported IDs** and survive Save
Draft. The page never silently removes desired IDs.

## Architecture boundary

The desired-state and database representation are unchanged:

```text
shared.services.blockedServiceIds
shared.services.blockedSchedule
```

The browser calls only:

```text
GET /api/v1/clusters/{clusterId}/blocked-services/catalogue
PUT /api/v1/clusters/{clusterId}/configuration-draft
```

The controller calls only the supported AdGuard Home catalogue operation:

```text
GET /control/blocked_services/all
```

Current state, deployment, and read-back continue using
`/control/blocked_services/get` and `/control/blocked_services/update`.
Deprecated blocked-service endpoints are not used.

Catalogue names and groups are observed presentation metadata. They are not
stored in revisions and do not enter desired, effective, verification, or
drift hashes. Upstream filtering rules and SVG icon payloads are discarded at
the adapter boundary; the page uses no copied branding assets.

## Merge, cache, and failure behavior

- The merged catalogue is the union of stable IDs reported by enabled nodes.
- Support and lack of support are retained per node.
- Metadata disagreements use deterministic majority/tie-break selection and
  affect presentation only.
- Per-node cache entries are keyed by node version and blocked-service
  capability signature with a 15-minute TTL.
- Version or capability changes force a fetch. An expired matching entry may
  be shown as stale after refresh failure, but stale metadata cannot pass
  publication preflight.
- Node failures return safe error codes and partial state; URLs, credentials,
  response bodies, and raw errors never cross the API boundary.
- Every selected ID must be present in every enabled node's current catalogue.
  Validation issues identify the affected node. Save Draft remains
  non-destructive and is allowed so operators can recover legacy drafts.

## Components and presentation

- `BlockedServicesPage` composes shared Phase 3 page, settings, feedback,
  status, and scope primitives.
- `ServiceCatalogue`, `ServiceGroup`, and `ServiceToggle` use native controls,
  client-side search/group filtering, selected count, group actions, and
  selected/unselected visual states.
- `ScheduleEditor` is extracted as a shared controlled component while keeping
  millisecond day ranges and Local/IANA time-zone semantics.
- Safe Browsing, parental control, and Safe Search render under Settings >
  General, not Blocked Services.
- Responsive styles use existing semantic tokens, so explicit/system light and
  dark themes share the same component code.

## Tests

Backend contracts cover pre-group and grouped AdGuard payloads, exact method
and path, invalid metadata, version rejection, multi-node merge, cache hit,
TTL refresh, stale fallback, version invalidation, authenticated controller
routing, unknown-ID preservation, and node-attributed publication preflight.

Frontend DOM tests cover loading through the dedicated page, raw-ID migration,
unknown and unsupported display, search, group filtering, service toggles,
select/clear group, selected count, stale/partial node states, schedule editing
and inline errors, and Save Draft without publication or deployment.

The PostgreSQL two-node integration workflow selects YouTube, publishes,
deploys, verifies both node payloads, rejects ChatGPT when the second node omits
it from its catalogue, and retains the existing direct-change drift workflow.
