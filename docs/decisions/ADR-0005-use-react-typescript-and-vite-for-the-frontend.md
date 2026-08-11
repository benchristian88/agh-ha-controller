# ADR-0005: Use React, TypeScript, and Vite for the frontend

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

The controller requires a rich administration interface with dashboard visualisation, structured diffs, long-running deployment progress, complex forms, and responsive state management.

## Decision

Build the frontend with React, strict TypeScript, and Vite.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- A mature ecosystem supports complex administration workflows.
- TypeScript improves API contract safety.
- Vite provides a lightweight development and build pipeline.
- The frontend remains a separate client of the controller API and must not contain business truth.

## Alternatives considered

- Server-rendered Go templates.
- Vue or Svelte.
- Fork the existing AdGuard Home frontend.

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
