# Script Reference

- `install-systemd.sh` resolves an exact `ATLAS_DNS_VERSION` (or the latest
  stable release), downloads the matching Linux amd64/arm64 archive and checksum
  from GitHub Releases, verifies it, and installs it on the Debian 13/systemd
  reference platform. It does not compile source. Use it through the
  [authoritative native guide](../docs/getting-started/native-systemd.md).
- `release-artifacts.sh` builds self-contained Linux amd64/arm64 archives,
  production Compose and environment inputs, the installer, licence, and
  SHA-256 checksums. It adds an SPDX JSON SBOM when `syft` is installed. Set
  `ATLAS_DNS_VERSION` explicitly; existing output is never overwritten.

Scripts are development/release tooling, not a second installation guide. They
must not print secrets or silently change existing runtime credentials.
