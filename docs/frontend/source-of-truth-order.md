# Frontend Source-of-Truth Order

During Release 0.4.1, use this precedence:

1. Current implementation audit.
2. Approved visual references and screenshots.
3. Current files in `docs/frontend/`.
4. Current product and ADR documents.
5. Shared component implementation and design tokens.
6. Existing functional behaviour and tests.
7. Existing visual implementation.
8. Superseded design documents.

## Explicit rule

Existing frontend presentation is not authoritative where it conflicts with:

- the Release 0.4 implementation audit;
- ADR-0026;
- approved navigation;
- current screen specifications.

Backend desired-state, revision, deployment, capability, verification, drift, security, and DHCP safety behaviour remain authoritative unless a separate architecture decision changes them.
