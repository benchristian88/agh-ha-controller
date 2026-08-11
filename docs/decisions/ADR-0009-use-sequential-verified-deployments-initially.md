# ADR-0009: Use sequential verified deployments initially

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

Applying configuration to every node simultaneously increases blast radius and makes partial failure harder to reason about. Early product reliability is more important than deployment speed.

## Decision

Validate all target nodes, then apply and verify one node at a time. Stop or follow an explicit policy when a node fails.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- A bad revision affects fewer nodes before detection.
- Per-node progress and recovery are clearer.
- Deployments take longer as node count grows.
- Parallel and canary strategies can be added later.

## Alternatives considered

- Parallel deployment to all nodes.
- Blind API writes without read-back.
- File synchronisation followed by simultaneous restart.

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
