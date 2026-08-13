# Roadmap

This roadmap records direction after the stable 1.0 baseline. It is not a
release promise. Completed chronology belongs in
[CHANGELOG.md](../../CHANGELOG.md), and historical plans remain in the
[pre-1.0 archive](../archive/pre-1.0/README.md).

## Current focus

- Maintain the supported 1.x upgrade, migration, backup, and configuration
  contracts.
- Expand real-world compatibility evidence without overstating untested
  AdGuard Home, browser, operating-system, or deployment combinations.
- Address security, reliability, accessibility, and performance defects found
  by operators.
- Keep installation artifacts reproducible and independent of build toolchains
  on production hosts.

## Evidence-triggered work

### Optional local Query Log forwarder

Native AdGuard Home API polling remains the standard collection path. A local
forwarder will be considered only if measured production evidence shows
unacceptable loss from node-local retention, polling latency, or event identity
ambiguity and the operational/security cost is justified. Any implementation
requires a new ADR, threat model, credentials/spool/upgrade design,
compatibility plan, and explicit opt-in migration. No release is assigned.

## Uncommitted topics

- OIDC and finer-grained roles.
- Controller high availability.
- More deployment strategies and maintenance scheduling.
- Automatic backup destinations and signed release artifacts.
- Broader platform packaging and compatibility ranges.

Prioritisation requires operator evidence, security analysis, and an explicit
scope decision. The [feature catalogue](../reference/features.md) is the
authority for what exists today.
