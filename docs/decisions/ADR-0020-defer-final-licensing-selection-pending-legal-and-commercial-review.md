# ADR-0020: Defer final licensing selection pending legal and commercial review

**Status:** Superseded by ADR-0033
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/archive/pre-1.0/product/product-design-document.md`

## Context

The intended model combines free homelab use, external contributions, protection against repackaging and resale, and a future supported MSP edition. These goals may not all be compatible with an OSI-approved open-source licence.

## Decision

Do not select or claim a final licence until the product owner has obtained appropriate legal and commercial advice. Keep the repository marked as unlicensed or private during pre-release development.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The project avoids accidentally granting rights inconsistent with its business intent.
- Public contributions cannot be accepted safely until contribution and licence terms are clear.
- A decision is required before public community release.
- Potential models include permissive/open-core, copyleft, source-available, dual licensing, and contributor agreements.

## Alternatives considered

- Choose a licence based only on familiarity.
- Call the project open source while using incompatible restrictions.
- Accept significant external code before contribution terms are defined.

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
