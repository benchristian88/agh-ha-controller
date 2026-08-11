# ADR-0015: Make central query-log collection privacy-conscious and configurable

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

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

## Release 0.6 implementation

API polling is the first implementation of this decision. Collection is an
explicit controller setting, enabled by default for the Release 0.6 product
outcome, and can be disabled without deleting retained events. Central retention
defaults to seven days and is independently bounded between one hour and 90
days. The UI states both the observational/privacy boundary and partial
coverage. Normalization excludes credentials, node URLs, raw payloads, and
mutable display-name enrichment from identity; diagnostic bundles exclude raw
events by default.

The source API has no event ID. AGH HA Controller therefore uses a node-scoped SHA-256
fingerprint plus occurrence ordinal and an overlapping `older_than` polling
window. This deliberately preserves indistinguishable legitimate repeats and
documents that perfect identity cannot be recovered after source reordering or
node-local retention. The later file forwarder may improve fidelity without
changing the central event or privacy boundary.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.
