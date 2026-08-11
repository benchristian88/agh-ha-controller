# ADR-0016: Make node management capability-aware and version-aware

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

A controller that assumes every node supports every setting may produce failed or unsafe deployments, particularly across upgrades.

## Decision

Discover and persist node version and capabilities, validate every effective configuration against targets, and surface unsupported behaviour before mutation.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Mixed-version clusters can be represented honestly.
- The compatibility matrix becomes an explicit release artifact.
- Some features may remain unavailable until all nodes are upgraded.
- Capability discovery and fixtures add ongoing maintenance work.

## Alternatives considered

- Assume API compatibility across versions.
- Require all nodes to run one hard-coded version.
- Attempt writes and infer support only from errors.

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
