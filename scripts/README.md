# Script Reference

- `install-systemd.sh` builds and installs `CONTROLLER_VERSION` (default
  `0.9.2-dev`) on the Debian 13/systemd reference platform. Use it through the
  [authoritative native guide](../docs/getting-started/native-systemd.md).
- `release-artifacts.sh` builds Linux amd64/arm64 controller and backup binaries,
  migrations, frontend archive, SHA-256 checksums, and an SPDX JSON SBOM when
  `syft` is installed. Set `CONTROLLER_VERSION` explicitly for release work.

Scripts are development/release tooling, not a second installation guide. They
must not print secrets or silently change existing runtime credentials.
