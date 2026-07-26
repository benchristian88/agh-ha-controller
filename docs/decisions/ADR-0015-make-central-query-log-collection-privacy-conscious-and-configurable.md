# ADR-0015: Make central query-log collection privacy-conscious and configurable

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

DNS query history can reveal sensitive browsing and service use. Central aggregation increases usefulness and concentration risk.

## Decision

Treat raw query collection as an explicit, visible feature with configurable retention, secure access, redacted diagnostics, and no external telemetry by default.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Users understand when data is being stored.
- Short retention can be the default.
- Future RBAC must protect query-log access.
- Deletion and retention processes become product features, not background assumptions.

## Alternatives considered

- Collect all query logs indefinitely by default.
- Send anonymised telemetry externally without explicit consent.
- Exclude query-log privacy from the product security model.

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
