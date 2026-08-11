# ADR-0010: Separate shared configuration from node-specific overrides

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

HA nodes should share filtering policy but necessarily differ in addresses, interfaces, hostnames, certificates, and sometimes DHCP responsibilities. A single identical document cannot safely represent both realities.

## Decision

Model cluster-shared configuration separately from node-specific managed overrides, then merge them into effective state for each node.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The controller can converge shared policy without overwriting infrastructure identity.
- Diffs and UI must show scope.
- Validation must run against each effective node configuration.
- Override growth must be controlled to avoid turning every node into a unique snowflake.

## Alternatives considered

- Force byte-identical configuration on all nodes.
- Exclude all node-specific values from controller management.
- Maintain a complete unrelated configuration document for every node.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.
