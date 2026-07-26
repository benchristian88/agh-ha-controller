# AGH HA Controller

AGH HA Controller is an open-source management plane for running two or more AdGuard Home instances as a coordinated, highly available DNS service.

AdGuard Home remains the DNS engine. AGH HA Controller provides the shared control plane for configuration, authentication, revision history, deployment, drift detection, statistics aggregation, and eventually central query-log ingestion.

## Why this project exists

Running two AdGuard Home servers gives DNS redundancy, but it does not create a true HA management experience. Each node still has its own configuration, statistics, query logs, users, and operational state.

AGH HA Controller is intended to solve that gap by providing:

- One login and one management interface.
- A single authoritative desired configuration.
- Safe deployment of changes to every node.
- Automatic detection and correction of configuration drift.
- Revision history, comparison, rollback, and audit logging.
- Cluster-wide health, statistics, and query logs.
- Node-level attribution for troubleshooting and capacity analysis.
- A failure model where DNS continues working even when the controller is offline.

## Project status

This repository is currently a design and implementation scaffold.

The first meaningful product milestone is the configuration-control MVP:

1. Register two or more AdGuard Home nodes.
2. Import an existing node configuration.
3. Store an authoritative desired state.
4. Compare desired state with each node.
5. Deploy a new revision.
6. Verify convergence.
7. Detect and correct direct changes made on a node.
8. Roll back to a previous revision.

See [docs/roadmap/roadmap.md](docs/roadmap/roadmap.md) for the full release plan.

## Reference deployment

The initial reference deployment assumes:

- Two Debian 13 LXCs running AdGuard Home.
- One Debian 13 LXC running AGH HA Controller.
- PostgreSQL on the controller host or a separate database host.
- Node communication over HTTPS using the AdGuard Home REST API.
- systemd-managed controller services.
- Optional Go-based query-log forwarders in later releases.

## Architecture principles

- **Controller is not in the DNS path.**
- **AdGuard Home remains independently functional.**
- **Desired state lives in the controller.**
- **Applied state lives on each node.**
- **Manual node changes are treated as drift.**
- **Node-specific settings are modelled explicitly.**
- **All deployments are revisioned and auditable.**
- **Backward-compatible, capability-aware node management is required.**

The complete architecture is documented in [docs/architecture/architecture.md](docs/architecture/architecture.md).

## Proposed technology stack

### Controller backend

- Go
- PostgreSQL
- REST API
- Background reconciliation workers
- Structured logging
- Prometheus-compatible metrics

### Frontend

- React
- TypeScript
- Vite
- Component-driven feature modules
- Dark mode modelled closely on AdGuard Home
- Responsive desktop-first administration interface

### Forwarder

- Go static binary
- systemd service
- Local disk spool
- At-least-once delivery
- Controller-side deduplication

## Repository layout

```text
cmd/                  Executable entry points
internal/             Controller domain and infrastructure packages
web/                  React frontend
migrations/           PostgreSQL database migrations
packaging/            systemd and Docker packaging
scripts/              Development and release scripts
tests/                Integration and end-to-end tests
examples/             Example configuration
docs/                 Product, architecture, design, and operations docs
```

## Getting started

The source code has not yet been implemented. Begin with:

1. Read `AGENTS.md`.
2. Read `docs/architecture/architecture.md`.
3. Read `docs/roadmap/roadmap.md`.
4. Review `docs/database/database-design.md`.
5. Review `docs/frontend/frontend-design.md`.
6. Implement Release 0.1 from the roadmap.

## Initial development order

1. Repository tooling and CI.
2. Database migrations.
3. Local authentication.
4. Node registration and encrypted credential storage.
5. AdGuard Home client library.
6. Health polling.
7. Configuration inventory.
8. Canonical configuration model.
9. Revision and deployment engine.
10. Reconciliation and drift correction.

## Licensing

No final licence has been selected yet.

Do not add a licence file or copy third-party code until the project owner confirms the intended licensing model. The intended commercial posture is:

- Free use for personal and homelab environments.
- Open contribution model.
- Protection against third parties repackaging and selling the project as their own product.
- A future supported commercial edition for MSP and business use.

That intent may require a source-available licence rather than an OSI-approved open-source licence. Legal advice should be obtained before release.

## Documentation index

- [Architecture](docs/architecture/architecture.md)
- [Configuration model](docs/architecture/configuration-model.md)
- [Reconciliation engine](docs/architecture/reconciliation-engine.md)
- [Deployment architecture](docs/architecture/deployment.md)
- [Roadmap](docs/roadmap/roadmap.md)
- [Release plan](docs/roadmap/release-plan.md)
- [Frontend design](docs/frontend/frontend-design.md)
- [Database design](docs/database/database-design.md)
- [API design](docs/api/controller-api.md)
- [Security model](docs/security/security.md)
- [Local development](docs/development/local-development.md)
- [Testing strategy](docs/development/testing.md)
- [Operational runbook](docs/operations/runbook.md)
