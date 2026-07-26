# Configuration Model

## Objective

Represent AdGuard Home configuration in a stable, revisioned, version-aware model that separates shared cluster policy from node-specific infrastructure details.

## Configuration layers

### Shared cluster configuration

Examples:

- Upstream DNS servers.
- Bootstrap DNS.
- Filtering settings.
- Filter subscriptions.
- Custom filtering rules.
- Allow lists.
- Persistent clients.
- DNS rewrites.
- Blocked services.
- Safe browsing.
- Parental controls.
- Safe search.
- Query-log policy.
- Statistics policy.

### Node-specific overrides

Examples:

- Bind addresses.
- Web administration address.
- TLS certificate and key references.
- Hostnames.
- Interface selection.
- DHCP role and interface.
- Node labels.
- Site metadata.
- Maintenance state.

## Model shape

```yaml
schemaVersion: 1
shared:
  dns:
    upstreams:
      - https://dns.quad9.net/dns-query
  filtering:
    enabled: true
  queryLog:
    enabled: true
nodes:
  node-a-id:
    bindHosts:
      - 192.168.3.10
  node-b-id:
    bindHosts:
      - 192.168.3.11
```

This example is illustrative, not a final public schema.

## Revision lifecycle

- Draft: mutable operator workspace.
- Validated revision: immutable configuration snapshot.
- Deployment: attempt to apply a revision to selected nodes.
- Applied revision: revision verified on a node.
- Superseded revision: previously active revision.
- Rolled-back revision: a previous revision redeployed as a new deployment.

Revisions are never edited after creation.

## Canonicalisation

Canonicalisation must:

- Sort unordered collections.
- Preserve ordered collections where order changes behaviour.
- Strip API-generated timestamps and counters.
- Normalise null and empty representations.
- Normalise IP addresses and CIDR notation.
- Normalise domain casing where semantics allow.
- Preserve comments and operator labels separately from deployable state.
- Produce deterministic serialisation.

## Configuration ownership

Each field should eventually be classified as:

- Controller-managed.
- Node-specific managed.
- Observed only.
- Unsupported.
- Ignored.
- Secret reference.

## Import behaviour

On first node onboarding:

1. Read supported configuration.
2. Normalise it.
3. Present import summary.
4. Create an initial draft.
5. Require explicit operator acceptance.
6. Create Revision 1.
7. Mark the imported node as converged.
8. Compare additional nodes against Revision 1.

The controller must not overwrite a newly added node before showing the differences.

## Adoption behaviour

When drift is detected, manual adoption should:

1. Show a structured difference.
2. Identify whether the changed field is shared or node-specific.
3. Validate the changed value.
4. Create a new draft.
5. Require an operator to save a revision.
6. Never mutate desired state silently.
