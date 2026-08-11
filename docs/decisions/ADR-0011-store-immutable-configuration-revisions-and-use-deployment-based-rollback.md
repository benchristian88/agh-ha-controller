# ADR-0011: Store immutable configuration revisions and use deployment-based rollback

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

Operators need to know what changed, who changed it, and which configuration was applied. Editing historical records would break auditability and make rollback ambiguous.

## Decision

Publish complete immutable revisions. Rollback by creating a new deployment of a selected historical revision, without editing history.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Revision comparison and audit remain trustworthy.
- Rollback is explicit and itself auditable.
- Storage usage is higher than patch-only history but manageable.
- Schema migration of old revisions must be designed carefully.

## Alternatives considered

- Mutate one current configuration row.
- Store only textual patches.
- Restore node backup files outside the deployment model.

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
