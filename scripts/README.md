# Scripts

## Implemented

- `install-systemd.sh`: build and install Release 0.8.0 from a git checkout on a Debian LXC or host. It provisions the service account, local PostgreSQL database, protected runtime environment, frontend, binary, and systemd unit. Existing runtime secrets are preserved on rerun. Production builds use portable source discovery and every install or upgrade restarts and verifies the service so frontend and API versions cannot diverge.

## Planned

- Release checksum generation.
- Proxmox LXC installer.
- Automated backup and restore helpers.
