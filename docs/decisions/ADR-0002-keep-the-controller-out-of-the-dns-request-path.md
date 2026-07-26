# ADR-0002: Keep the controller out of the DNS request path

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

DNS is foundational infrastructure. A management controller that becomes necessary for query resolution would introduce a new single point of failure and undermine the reason for running redundant AdGuard Home nodes.

## Decision

DNS clients communicate directly with AdGuard Home nodes. The controller does not proxy, forward, intercept, balance, or otherwise participate in ordinary DNS requests.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- DNS continues during controller or database outages.
- Network architecture remains simple and compatible with existing DHCP, client, VRRP, and load-balancing arrangements.
- The controller cannot directly guarantee traffic distribution or resolver failover; those remain external network responsibilities.
- Availability tests must explicitly prove controller independence.

## Alternatives considered

- Use controller as a DNS reverse proxy or load balancer.
- Embed a shared DNS data plane in the controller.
- Require nodes to query controller for policy on each request.

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
