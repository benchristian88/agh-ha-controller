# Release Process

## Pre-release

1. Freeze scope.
2. Update changelog.
3. Confirm migration path.
4. Run all tests.
5. Build binaries and images.
6. Test reference LXC deployment.
7. Test upgrade from previous release.
8. Review security changes.
9. Update compatibility matrix.
10. Create release notes.

## Artifacts

Implemented through 0.9:

- Source-build Docker image and Compose definition.
- Git-checkout systemd installer.
- Versioned PostgreSQL migrations with rollback guards.
- Backend race tests, frontend unit/type/lint/build checks, and Compose configuration validation.
- Linux amd64/arm64 controller, migration, and backup binaries.
- Versioned frontend archive and SHA-256 checksum manifest.
- Optional SPDX JSON SBOM when `syft` is present.

Planned:

- Forwarder binaries.
- Published container image.
- Signature or provenance metadata.
- Prebuilt-binary installation script/package (the current systemd installer
  builds a versioned checkout from source).
- Upgrade notes.

## Release 0.4 gate

The code-complete gate includes schema-v1 compatibility, schema-v2 adapter and contract tests, immutable revision/deployment integration tests, frontend checks, binary and production-web builds, migration review, and documentation reconciliation. Release validation additionally requires browser accessibility and visual checks, write/read-back against supported AdGuard Home v0.107.53 and v0.107.78 reference nodes, an explicit DHCP disable-before-enable handoff exercise, and Docker and systemd upgrades from 0.3. These environment-dependent checks must be recorded in the feature ledger before 0.4 is marked complete.

## Release 0.4.1 gate

Phase 10 locally validates canonical routes/redirects, Not Found, navigation
and context, representative light/dark responsive baselines, WCAG structural
checks, full frontend and Go race/vet/build gates, production dependencies, and
source-build version consistency. Packaged Docker/systemd clean install and
upgrade from 0.4, PostgreSQL migration/persistence, supported real-node
write/read-back, controlled DHCP handoff/reset, and controller-outage DNS
evidence remain reference-environment checks. See the Phase 10 regression
report; unavailable checks must not be reported as passing.

## Post-release

- Monitor issue reports.
- Triage regressions.
- Publish urgent patch guidance.
- Update known issues.

## Release 0.9 artifact and feature-freeze gate

Set an explicit stable version and run `make release-artifacts
CONTROLLER_VERSION=0.9.0`. The script emits Linux amd64/arm64 controller,
migration and backup binaries, frontend assets, and `SHA256SUMS`; it emits an
SPDX JSON SBOM when `syft` is available. Docker build arguments must use the
same version, commit, and UTC build time. Stable artifacts must never retain the
`-dev` version or unknown build fields.

No signing infrastructure is claimed until a protected release-key lifecycle
is approved. Publish checksums over HTTPS with the release and require native
operators to verify them before replacing binaries.

Release 0.9 reaches feature freeze only after
`development/release-0.9-validation.md` records every automated and external
gate. Afterward, 1.0 accepts defects, security/migration/upgrade/usability and
compatibility blockers, documentation/release-engineering work, and the
deliberate rename—not new major capability areas.
