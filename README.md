# AGH HA Controller

AGH HA Controller is a management plane for running two or more AdGuard Home instances as a coordinated, highly available DNS service.

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

Release 0.2 implements read-only configuration inventory. Operators can collect version-aware DNS and filtering snapshots, see explicit capabilities and unsupported areas, compare nodes semantically, and import a reviewed snapshot into a non-authoritative draft. Releases 0.1 and 0.1.1 have been production-build validated through both Docker and systemd installs. Publishing, deployment, and drift correction remain Release 0.3; see the [feature ledger](docs/product/feature-ledger.md).

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

## Technology stack

### Services implemented in 0.2

- `agh-ha-controller`: one Go process providing the `/api/v1` REST API, same-origin React UI, authentication, cluster/node management, health polling, read-only configuration observation, capability discovery, semantic comparison, confirmed draft import, session cleanup, audit access, and operational probes.
- PostgreSQL 17: the system of record for foundation data plus capability profiles, immutable observation attempts, canonical hashes/documents, and one optimistic inventory draft per cluster.
- AdGuard Home nodes: independent DNS services contacted through read-only `/control/status`, `/control/dns_info`, and `/control/filtering/status` requests. They continue serving DNS during controller outages.

The controller has no AdGuard Home configuration writer in 0.2. Published revisions, deployments, reconciliation, statistics ingestion, query-log ingestion, and the forwarder remain later milestones.

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

Planned for a later release: Go static binary, systemd service, local disk spool, at-least-once delivery, and controller-side deduplication.

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

## Install with Docker Compose

On an LXC or host with Git, Docker Engine, and Docker Compose v2:

```bash
git clone https://github.com/benchristian88/agh-ha-controller.git
cd agh-ha-controller
cp .env.example .env
openssl rand -hex 24
openssl rand -base64 48
openssl rand -base64 32
```

Put those three generated values into `POSTGRES_PASSWORD`, `SESSION_SECRET`, and `CREDENTIAL_ENCRYPTION_KEY` in `.env`. Set `PUBLIC_BASE_URL` to the URL browsers use, then run:

```bash
docker compose up --build --detach
docker compose ps
```

The stack builds the Go controller and React UI from the checkout, runs PostgreSQL 17 with a persistent named volume, applies embedded migrations, and exposes port 8080 by default. Use `docker compose logs -f controller` for startup diagnostics. Back up the PostgreSQL volume and `.env`; losing `CREDENTIAL_ENCRYPTION_KEY` makes stored node credentials unrecoverable.

## Install directly with systemd

The reference path is Debian 13, including an unprivileged Debian LXC. Install PostgreSQL, Go 1.24, Node.js 22/npm, Git, Make, and OpenSSL, clone the repository, then run:

```bash
cd agh-ha-controller
sudo PUBLIC_BASE_URL=https://controller.example.test ./scripts/install-systemd.sh
```

The installer builds from source without requiring ripgrep, creates the `aghha` service account and PostgreSQL database, generates protected secrets, installs the binary/UI, enables the hardened service, and preserves `/etc/agh-ha-controller/agh-ha-controller.env` on reruns. Inspect it with `systemctl status agh-ha-controller` and `journalctl -u agh-ha-controller -f`.

## Configuration inventory

After adding nodes, open `/ha/configuration`. Refresh each node to create an immutable observation, compare two successful snapshots, and review differences grouped as shared-managed, node-specific, observed-only, or unsupported. Import requires confirmation and creates only a mutable draft; it never changes a node or makes the controller authoritative.

Canonical schema v1 covers upstream/bootstrap/fallback/private reverse DNS, filtering enablement and interval, enabled filter subscriptions, custom rules, bind hosts, and DNS port. TLS, DHCP, clients, rewrites, and service controls are deliberately deferred.

After either installation, open `PUBLIC_BASE_URL`. When the database has no users, the application shows “Create your administrator.” That transaction creates the only initial administrator and signs it in; setup returns HTTP 409 after any user exists. Then create a cluster and add each AdGuard Home node.

Upgrade a git installation by backing up PostgreSQL and runtime secrets, pulling the desired tag, and rerunning `docker compose up --build --detach` or `scripts/install-systemd.sh`. Embedded append-only migrations run at startup.

Development and test commands are documented in [local development](docs/development/local-development.md).

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
