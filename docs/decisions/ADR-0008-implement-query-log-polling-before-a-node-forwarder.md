# ADR-0008: Implement query-log polling before a node forwarder

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

A combined query log is valuable, but a node-side agent adds packaging, security, upgrade, and support complexity. The official API offers an earlier path to validate the user experience.

## Decision

Deliver API-based query-log polling first. Add an optional Go forwarder after the cluster configuration MVP and statistics releases.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The product can demonstrate central search without modifying nodes.
- Polling limitations will be measured with real workloads.
- The forwarder can be designed against evidenced gaps.
- Polling requires cursor, overlap, deduplication, and visible lag.

## Alternatives considered

- Build the forwarder before any query-log UI.
- Read shared network packet captures.
- Do not provide central query logs.

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
