# ADR-0004: Implement the controller and forwarder in Go

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

The project needs an API service, background jobs, network integrations, secure credential handling, and eventually a lightweight node-side forwarder. The reference environment is resource-conscious Debian LXC.

## Decision

Use Go for the controller backend and optional forwarder.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Static binaries simplify installation and upgrades.
- One language can be used across controller and forwarder.
- Go is well suited to networking, concurrency, and low-resource services.
- The team must maintain disciplined domain boundaries to avoid a monolithic package structure.

## Alternatives considered

- Rust for maximum safety and performance.
- Python for faster early scripting.
- Node.js for a shared frontend/backend language.

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
