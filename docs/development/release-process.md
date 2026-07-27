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

Implemented for 0.1.1:

- Source-build Docker image and Compose definition.
- Git-checkout systemd installer.

Planned:

- Linux amd64 binary.
- Linux arm64 binary.
- Forwarder binaries.
- Container image.
- Checksums.
- SBOM.
- Signature or provenance metadata.
- Installation script.
- Upgrade notes.

## Post-release

- Monitor issue reports.
- Triage regressions.
- Publish urgent patch guidance.
- Update known issues.
