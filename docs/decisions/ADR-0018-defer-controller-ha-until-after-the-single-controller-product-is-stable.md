# ADR-0018: Defer controller HA until after the single-controller product is stable

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

Controller HA introduces leader election, shared scheduling, deployment ownership, session behaviour, and database availability concerns. It is not needed to keep DNS available because the controller is outside the data path.

## Decision

Ship and harden a single-controller architecture first. Preserve durable state and process boundaries that allow controller HA later.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The core product remains achievable.
- DNS availability is not compromised by the deferral.
- Management operations are unavailable during controller outage.
- Durable jobs and idempotency remain required to avoid blocking future HA.

## Alternatives considered

- Build active-active controllers from the first release.
- Use embedded consensus immediately.
- Treat controller outage as a DNS outage.

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
