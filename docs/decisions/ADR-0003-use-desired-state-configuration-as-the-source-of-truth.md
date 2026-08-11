# ADR-0003: Use desired-state configuration as the source of truth

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

Simple synchronisation does not establish intent. If two nodes differ, a timestamp or last-writer rule cannot reliably determine which configuration is correct. Safe HA operation needs a durable representation of operator intent.

## Decision

Store a canonical desired configuration in the controller. Derive node-effective configurations from shared state and node overrides. Compare observed node state with desired state and reconcile according to explicit policy.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The controller can explain drift and verify convergence.
- Direct node changes do not automatically become authoritative.
- The data model must distinguish desired, effective, observed, and applied state.
- Import and adoption require explicit operator confirmation.

## Alternatives considered

- Last-writer-wins synchronisation.
- Treat Node A as a permanent primary configuration source.
- Copy files between nodes without a canonical model.

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
