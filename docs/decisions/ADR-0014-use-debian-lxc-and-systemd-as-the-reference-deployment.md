# ADR-0014: Use Debian LXC and systemd as the reference deployment

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

The initial target user operates a Proxmox homelab and wants a simple controller LXC alongside two AdGuard Home LXCs. Supporting every packaging model at once would dilute early delivery.

## Decision

Use Debian 13 LXC with systemd as the primary reference. Add Docker Compose and a Proxmox community installer after the application runtime is stable.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The first installation and support path is concrete.
- Static Go binaries fit systemd deployment well.
- Container packaging remains an important but secondary path.
- Documentation and tests must avoid hard-coding one private network or domain.

## Alternatives considered

- Docker-only release.
- Kubernetes-first deployment.
- Install controller inside an AdGuard Home node.

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
