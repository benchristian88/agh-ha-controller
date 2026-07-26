# ADR-0012: Support Enforce, Alert, and Manual reconciliation policies

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

Different operators and settings have different tolerance for automatic correction. A single always-enforce or never-enforce model would either be unsafe or fail to deliver desired-state value.

## Decision

Provide three initial reconciliation policies: Enforce, Alert, and Manual.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Operators can adopt automation progressively.
- Policy must be visible in drift records and activity.
- Automatic correction still requires verification and audit.
- Section-specific policies may be added later.

## Alternatives considered

- Always overwrite direct changes.
- Only notify and never correct.
- Use last writer as authority.

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
