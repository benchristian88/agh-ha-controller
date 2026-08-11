# Scripts

## Implemented

- `install-systemd.sh`: build and install the selected `CONTROLLER_VERSION` (default `0.9.1-dev`) from a git checkout on a Debian LXC or host. It provisions the service account, local PostgreSQL database, protected runtime environment, controller and backup binaries, frontend, and systemd unit. Existing runtime secrets are preserved on rerun. Every install or upgrade restarts and verifies the service so frontend and API versions cannot diverge.
- `release-artifacts.sh`: with `CONTROLLER_VERSION` set, creates repeatable Linux amd64/arm64 controller, migration and backup binaries, a frontend archive, SHA-256 checksums, and an SPDX JSON SBOM when `syft` is installed. Signing is deliberately excluded until a release-key process exists.

## Planned

- Release checksum generation.
- Proxmox LXC installer.
