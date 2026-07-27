# ADR-0022: Support git-based systemd and Docker Compose installation in 0.1.1

**Status:** Accepted

**Date:** 28 July 2026

**Decision owners:** Project owner and maintainers
**Related release:** 0.1.1

## Context

ADR-0014 selected Debian LXC and systemd as the reference deployment and deferred Docker Compose until the runtime was stable. Release 0.1 implemented the combined controller/worker process, same-origin frontend, PostgreSQL schema, runtime validation, and health endpoints. Operators now need a complete installation from a git checkout on either a Docker-enabled LXC or a directly built Debian host.

## Decision

Keep Debian 13 LXC with systemd as the reference topology and support two source-based installation paths in Release 0.1.1:

- a repository installer that builds the Go and React artifacts, provisions local PostgreSQL and a service account, generates protected runtime secrets, and installs the hardened systemd service;
- a production Docker Compose stack that builds a multi-stage non-root controller image and runs PostgreSQL 17 with persistent storage.

Both paths run the same controller binary, serve the frontend on the API origin, apply the same embedded append-only migrations, require an explicit public origin, and preserve PostgreSQL as the system of record. Neither path adds a DNS listener or places the controller in the DNS data path.

## Consequences

- Docker installation is delivered earlier than ADR-0014 originally anticipated, while systemd remains the reference path.
- A git checkout and local build toolchain or Docker builder are required; signed prebuilt release artifacts remain future work.
- Docker runtime secrets reside in an operator-protected untracked `.env`; systemd secrets reside in a root-only environment file.
- Database and runtime-secret backups are required before upgrade in both modes.
- The Proxmox community installer, automated backup/restore, checksums, SBOM, and signed artifacts remain deferred.

## Alternatives considered

- Continue to defer Docker Compose until 1.0.
- Publish only prebuilt binaries or images.
- Embed PostgreSQL in the controller process.
- Run the controller inside an AdGuard Home node.

## Review triggers

Review when signed artifacts are published, external PostgreSQL becomes a documented Compose topology, automated upgrade/rollback is introduced, or the frontend is embedded into a single binary.
