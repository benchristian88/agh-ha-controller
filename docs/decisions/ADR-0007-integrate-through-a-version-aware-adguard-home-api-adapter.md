# ADR-0007: Integrate through a version-aware AdGuard Home API adapter

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

AdGuard Home versions may expose different endpoints, defaults, or payload semantics. Allowing raw API types to spread across the controller would make compatibility and testing fragile.

## Decision

Create a dedicated adapter layer that maps AdGuard Home APIs into stable controller domain models and capability-specific interfaces.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Compatibility behaviour is localised and testable.
- The domain model remains independent from raw endpoint payloads.
- Unsupported fields can be surfaced before mutation.
- Fixtures and contract tests are required for supported versions.

## Alternatives considered

- Call AdGuard Home endpoints directly from services and UI handlers.
- Manage configuration files directly as the normal method.
- Support only one exact AdGuard Home version.

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
