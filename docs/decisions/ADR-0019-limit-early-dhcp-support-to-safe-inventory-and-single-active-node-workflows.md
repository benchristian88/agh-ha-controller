# ADR-0019: Limit early DHCP support to safe inventory and single-active-node workflows

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

DHCP HA has different safety and network semantics from DNS HA. Enabling identical DHCP service on multiple nodes can cause conflicts, while ignoring DHCP entirely leaves a visible AdGuard Home feature gap.

## Decision

Initially support DHCP visibility, desired configuration modelling, and guarded single-active-node roles. Defer active-active DHCP coordination until it has a dedicated design.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The controller avoids creating competing DHCP servers.
- Operators can still see and manage limited DHCP state.
- UI and validation must make the active node explicit.
- Full DHCP failover remains out of scope.

## Alternatives considered

- Enable DHCP identically on every node.
- Implement a proprietary DHCP failover protocol immediately.
- Hide DHCP completely even when enabled on nodes.

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
