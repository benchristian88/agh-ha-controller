# Roadmap

This roadmap records direction beyond the current pre-1.0 tree. It is not a
release promise. Completed release chronology belongs only in
[CHANGELOG.md](../../CHANGELOG.md), and historical plans are indexed in the
[pre-1.0 archive](../archive/pre-1.0/README.md).

## Current focus: supported 1.0 candidate

The next candidate milestone is a stable supported release. Its scope remains
subject to completed validation and the project owner's legal decisions:

- Perform the deliberate AGH HA Controller → Atlas DNS Controller technical
  rename using the [rename inventory](../reference/rename-inventory.md).
- Complete the inherited packaged Chromium/Firefox/Safari/iOS, Docker, systemd,
  PostgreSQL, backup/restore, and real-node validation matrix.
- Publish an evidence-based compatibility/support statement.
- Resolve ADR-0020 and add the resulting licence/contribution terms.
- Verify clean installation and supported upgrade/rollback paths with release
  artifacts and documentation using final technical names.
- Apply only stability, security, accessibility, and documentation corrections
  discovered by those gates; no new DNS capability area is implied.

The current `Atlas` artwork foundation does not authorize any partial technical
rename before this deliberate pass.

## Under consideration / evidence-triggered

### Optional local Query Log forwarder

Native AdGuard Home API polling remains the standard collection path. A local
forwarder is considered only if measured production evidence shows unacceptable
loss from node-local retention, polling latency, or event identity ambiguity and
the operational/security cost is justified. Any implementation requires a new
ADR, threat model, credentials/spool/upgrade design, compatibility plan, and
explicit opt-in migration. No release is assigned.

## Uncommitted topics

The following are known product questions, not scheduled commitments:

- OIDC and finer-grained roles.
- Controller high availability.
- More deployment strategies and maintenance scheduling.
- Automatic backup destinations and signed release artifacts.
- Broader platform packaging and compatibility ranges.

Prioritization requires operator evidence, security analysis, and an explicit
scope decision. Consult the [feature catalogue](../reference/features.md) for
what exists today.
