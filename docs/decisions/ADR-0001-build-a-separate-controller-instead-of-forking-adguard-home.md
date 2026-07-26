# ADR-0001: Build a separate controller instead of forking AdGuard Home

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The product needs to add shared configuration, revision history, drift management, aggregated observability, and HA workflows around multiple AdGuard Home nodes. The project could either maintain a fork of AdGuard Home or build an independent controller around unmodified nodes.

## Decision

Build AGH HA Controller as a separate application. Continue to use standard AdGuard Home nodes and integrate through their administration APIs. Do not require a custom AdGuard Home build for the core product.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Existing installations can be onboarded without replacing their DNS software.
- AdGuard Home upgrades remain independently selectable.
- The project avoids inheriting responsibility for maintaining a DNS resolver and filter engine.
- The controller must maintain an explicit compatibility layer and may not be able to manage every feature immediately.

## Alternatives considered

- Fork AdGuard Home and build HA features into its existing backend and UI.
- Create a new DNS server with native clustering.
- Use only external scripts without a persistent controller.

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
