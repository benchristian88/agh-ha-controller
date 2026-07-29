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
    upstreamDns:
      - https://dns.quad9.net/dns-query
  filtering:
    enabled: true
  queryLog:
    enabled: true
nodeOverrides:
  node-a-id:
    bindHosts:
      - 192.168.3.10
  node-b-id:
    bindHosts:
      - 192.168.3.11
```

Release 0.2 froze the per-node observed `Document` shape. Release 0.3 adds a distinct authoritative `DesiredDocument`: shared DNS/filtering values, `nodeOverrides`, and explicit unsupported areas. Observed-only product version never enters desired state. Schema v1 manages DNS upstream, bootstrap, fallback, and private reverse resolvers plus filtering enablement, interval, blocklist subscription URLs, and custom rules. Bind hosts and DNS port are required node overrides but are verification-only because AdGuard Home exposes no supported writer for them. TLS, DHCP, clients, rewrites, services, and whitelist subscriptions remain outside managed schema v1.

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
5. Create or update the cluster's optimistic configuration draft.
6. Compare additional nodes against that draft or source snapshot.

Release 0.3 validates and publishes the draft as an immutable numbered revision. Publication does not activate it. A revision becomes the cluster's `activeRevisionId` only after its durable deployment verifies every target. Draft updates and publication both use optimistic draft versions.

## Release 0.3 deployment boundary

The configuration adapter writes only the supported `/control/dns_config`, `/control/filtering/config`, `/control/filtering/add_url`, `/control/filtering/set_url`, and `/control/filtering/set_rules` contracts. It reads the result back through the observation adapter and compares canonical semantic values. All targets are freshly observed and capability-validated before the first write. A listener override difference blocks the whole deployment rather than editing node files.

The controller must not overwrite a newly added node before showing the differences.

## Adoption behaviour

When drift is detected, manual adoption should:

1. Show a structured difference.
2. Identify whether the changed field is shared or node-specific.
3. Validate the changed value.
4. Create a new draft.
5. Require an operator to save a revision.
6. Never mutate desired state silently.
