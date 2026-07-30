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

Implemented through 0.4:

- Source-build Docker image and Compose definition.
- Git-checkout systemd installer.
- Versioned PostgreSQL migrations with rollback guards.
- Backend race tests, frontend unit/type/lint/build checks, and Compose configuration validation.

Planned:

- Linux amd64 binary.
- Linux arm64 binary.
- Forwarder binaries.
- Published container image.
- Checksums.
- SBOM.
- Signature or provenance metadata.
- Installation script.
- Upgrade notes.

## Release 0.4 gate

The code-complete gate includes schema-v1 compatibility, schema-v2 adapter and contract tests, immutable revision/deployment integration tests, frontend checks, binary and production-web builds, migration review, and documentation reconciliation. Release validation additionally requires browser accessibility and visual checks, write/read-back against supported AdGuard Home v0.107.53 and v0.107.78 reference nodes, an explicit DHCP disable-before-enable handoff exercise, and Docker and systemd upgrades from 0.3. These environment-dependent checks must be recorded in the feature ledger before 0.4 is marked complete.

## Post-release

- Monitor issue reports.
- Triage regressions.
- Publish urgent patch guidance.
- Update known issues.
