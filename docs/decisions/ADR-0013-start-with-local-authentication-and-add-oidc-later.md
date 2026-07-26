# ADR-0013: Start with local authentication and add OIDC later

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The initial homelab product needs a dependable first-run experience without requiring an external identity provider. Advanced users will later expect Authentik, Keycloak, or another OIDC provider.

## Decision

Implement secure local users and sessions first. Add OIDC and richer RBAC after core controller workflows are stable.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Installation is self-contained.
- Authentication is not blocked on SSO design.
- The project must still design user IDs and audit actors so OIDC can be added cleanly.
- Local accounts require secure password storage, rate limiting, and recovery design.

## Alternatives considered

- Require OIDC from the first release.
- Single hard-coded administrator from environment variables.
- No authentication on trusted networks.

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
