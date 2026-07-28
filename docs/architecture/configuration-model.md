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

Release 0.2 freezes canonical schema version 1. Its implemented fields are DNS upstream, bootstrap, fallback, and private reverse resolvers; filtering enablement, update interval, enabled filter URLs, and custom rules; node-specific bind hosts and DNS port; observed-only product version; and explicit unsupported-area records. TLS, DHCP, clients, rewrites, and services remain outside schema v1.

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

Schema v1 preserves order for upstream resolvers, fallback resolvers, and custom filtering rules. It treats bootstrap resolvers, private reverse resolvers, bind hosts, and enabled filter URLs as unordered sets. Runtime cache counters, filter IDs, filter display names, rule counts, and last-update timestamps are discarded at the adapter boundary.

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
4. Require explicit operator acceptance.
5. Create or replace the cluster's optimistic inventory draft.
6. Compare additional nodes against that draft or source snapshot.

Release 0.2 stops here. Publishing immutable Revision 1, selecting an active revision, and recording convergence begin in Release 0.3.

The controller must not overwrite a newly added node before showing the differences.

## Adoption behaviour

When drift is detected, manual adoption should:

1. Show a structured difference.
2. Identify whether the changed field is shared or node-specific.
3. Validate the changed value.
4. Create a new draft.
5. Require an operator to save a revision.
6. Never mutate desired state silently.
