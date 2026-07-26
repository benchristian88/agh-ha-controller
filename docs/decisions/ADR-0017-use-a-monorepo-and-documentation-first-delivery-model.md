# ADR-0017: Use a monorepo and documentation-first delivery model

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The controller, frontend, forwarder, migrations, packaging, and documentation evolve together. Fragmenting them early would complicate versioning and AI-assisted development.

## Decision

Maintain one repository with Go executables, React frontend, database migrations, packaging, tests, PDD, and ADRs. Require documentation updates for material behaviour changes.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- One release can contain compatible backend, frontend, migrations, and forwarder artifacts.
- Architecture intent stays close to implementation.
- CI must handle multiple toolchains.
- Future independent SDKs may be split only when release independence is valuable.

## Alternatives considered

- Separate repositories immediately.
- Store architecture only in an external wiki.
- Treat documentation as optional after implementation.

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
