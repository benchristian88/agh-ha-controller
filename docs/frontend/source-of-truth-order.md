# Frontend Source-of-Truth Order

After Release 0.4.1 Phase 10, use this precedence:

1. Architecture rules, accepted ADRs, and regression safety rules.
2. Current implementation and passing behavioral tests.
3. `ui-navigation.md`, `navigation-and-shell.md`, the Release 0.4.1 roadmap,
   and the Phase 10 regression report.
4. Shared component implementation, design tokens, and approved Release 0.4.1
   screenshots.
5. Current feature presentation documents.
6. Historical audits and superseded design documents.

## Explicit rule

Existing frontend presentation is not authoritative where it conflicts with:

- the accepted findings from the historical Release 0.4 implementation audit;
- ADR-0026;
- approved navigation;
- current screen specifications.

Backend desired-state, revision, deployment, capability, verification, drift, security, and DHCP safety behaviour remain authoritative unless a separate architecture decision changes them.
