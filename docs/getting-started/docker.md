# Install with Docker Compose

This is the authoritative Docker installation and upgrade guide.

## Requirements

- A host or LXC with Git, Docker Engine, and Docker Compose v2.
- OpenSSL for generating secrets.
- An HTTPS origin for normal use. TLS may terminate at a trusted reverse proxy.
- Network access from the controller to each AdGuard Home administration API.

The controller container does not need the Docker socket, privileged mode, or a
DNS port.

## Install

```bash
git clone https://github.com/benchristian88/agh-ha-controller.git
cd agh-ha-controller
cp .env.example .env
openssl rand -hex 24
openssl rand -base64 48
openssl rand -base64 32
```

Edit `.env` and set the generated values as `POSTGRES_PASSWORD`,
`SESSION_SECRET`, and `CREDENTIAL_ENCRYPTION_KEY`. Set `PUBLIC_BASE_URL` to the
browser-visible origin. The database password must use URL-safe characters
because Compose interpolates it into `DATABASE_URL`.

```bash
docker compose config
docker compose up --build --detach
docker compose ps
docker compose logs --tail=100 controller
```

The stack starts PostgreSQL 17, builds the controller and frontend, applies
append-only migrations, and publishes port 8080 by default. Set
`CONTROLLER_BIND_ADDRESS` and `CONTROLLER_PORT` in `.env` to change host
exposure. Open `PUBLIC_BASE_URL`, create the initial administrator, and follow
the Setup Guide.

## Verify

```bash
curl --fail http://127.0.0.1:8080/health
curl --fail http://127.0.0.1:8080/ready
```

Then verify administrator login, add one cluster and node, test node
connectivity, and inspect Operational Status. `/ready` is PostgreSQL-aware;
`/health` only confirms process liveness.

## Upgrade

1. Create and preflight a portable backup. Preserve `.env` separately.
2. Read [CHANGELOG.md](../../CHANGELOG.md) and the compatibility matrix.
3. Fetch and select the intended tag or commit.
4. Rebuild and recreate the stack.

```bash
git fetch --tags
git checkout <approved-version>
docker compose up --build --detach
docker compose ps
docker compose logs --tail=100 controller
```

Confirm `/ready`, build metadata in About, active revision, node connectivity,
and collector recovery. Do not expose the Docker socket to the controller.

## Back up and restore

Use System → Backup & Restore or the packaged `agh-ha-backup` command. The
`controller-work` volume is temporary workspace, not retained backup storage.
Download archives to separate protected storage and preserve `.env`. Follow the
[backup and restore procedure](../operations/backup-and-restore.md) for the
stopped-controller, empty-database restore workflow.

## Uninstall boundary

`docker compose down` stops and removes containers but retains named volumes.
Deleting `postgres-data` destroys controller records and is outside routine
uninstallation; take and verify a backup before any volume removal.

## Troubleshooting

- `docker compose config` reports missing values: complete `.env`.
- Controller remains unhealthy: inspect `docker compose logs controller` and
  `docker compose logs postgres`.
- Secure login cookie is not retained: use an HTTPS `PUBLIC_BASE_URL` and verify
  reverse-proxy forwarding.
- A node is unreachable: verify controller-to-node HTTPS routing and certificate
  trust; DNS client routing is unrelated.

See the [operations runbook](../operations/runbook.md) for worker, storage,
drift, and collection diagnostics.
