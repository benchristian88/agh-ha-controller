# ADR-0006: Use PostgreSQL as the initial system of record

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The controller needs transactions for revisions and deployments, durable jobs, JSON documents, audit history, and eventually time-series-like query data. The first target remains a small homelab deployment.

## Decision

Use PostgreSQL for control-plane data, statistics snapshots, and initial query-event storage.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- One mature database reduces operational complexity.
- Transactions and constraints protect state changes.
- JSONB supports version-variable configuration documents.
- Time partitioning and rollups can extend the initial design.
- A dedicated analytical database remains possible later if measured scale requires it.

## Alternatives considered

- SQLite for simplest installation.
- ClickHouse from the first release.
- Separate control-plane and time-series databases immediately.

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
