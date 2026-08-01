# Release 0.4.1 Phases 0–2 Implementation Record

## Outcome

Release 0.4.1 Phases 0–2 align routing, Configuration Control, and the
application shell without changing desired-state or deployment semantics.

## Architecture and failure behaviour

- All feature writes still use the optimistic schema-v2 draft and existing
  controller API. The browser never calls an AdGuard Home node API.
- Configuration Control no longer mutates DNS/filter draft fields. Canonical
  settings and filter pages retain Save Draft.
- Validation, immutable publication, capability preflight, deployment preview,
  durable sequential deployment, read-back verification, rollback, drift, TLS
  redaction, and DHCP safety are unchanged.
- Shell context uses the existing nodes, revisions, deployments, and deployment
  detail reads. Failed context reads display `Unavailable` without replacing or
  blocking page content.
- Deferred and unimplemented canonical routes show an explicit planned state.
  Unknown paths show a 404.
- Configuration authoring requires a schema-v2 draft collected from the
  supported AdGuard Home 0.107.78 release. Obsolete draft schemas are not
  rendered or published; Configuration Control keeps observation/import and
  revision history available so the operator can replace them safely.

## Patch boundaries

1. Routing safety: explicit canonical route resolution, redirect table,
   trailing-slash normalisation, planned states, and Not Found.
2. Configuration Control: schema-v2 domain summaries and active-revision change
   markers replace the narrow editor; lifecycle workflows remain.
3. Shell: shared navigation data drives desktop dropdowns and the mobile drawer;
   the context row and administration menu use the same shell on every route.

## API dependencies

No API contract or backend implementation changed. The global context reads:

- `GET /api/v1/clusters/{clusterId}/nodes`;
- `GET /api/v1/clusters/{clusterId}/configuration-revisions`;
- `GET /api/v1/clusters/{clusterId}/deployments`;
- `GET /api/v1/deployments/{deploymentId}` only when a deployment is active.

## Test and visual coverage

- Route tests cover all canonical paths, unknown paths, legacy redirects, and
  trailing slashes.
- Navigation tests cover canonical link targets and active-child parent state.
- Draft-summary tests cover all schema-v2 authoring domains and active-revision
  change markers.
- Existing configuration compatibility and validation-guidance tests remain.
- Desktop and mobile production-build captures are stored under
  `docs/frontend/screenshots/release-0.4.1/`.
