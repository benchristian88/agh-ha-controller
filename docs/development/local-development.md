# Local Development

## Prerequisites

- Go 1.24.
- Node.js 22 and npm.
- Docker Engine with Docker Compose v2.20 or newer (`docker compose`, not the retired `docker-compose` binary).
- `make` and `rg`.

PostgreSQL and AdGuard Home do not need to be installed on the host. The Release 0.1 Compose environment supplies PostgreSQL 17 and two authenticated status-contract simulators.

## Complete local test suite

From the repository root in a clean checkout:

```bash
make bootstrap
make test-local
make test-env-down
```

`make test-local` performs these operations:

1. Builds and starts `compose.test.yml` and waits for all three services to become healthy.
2. Runs every Go test with a real PostgreSQL connection and the two containerised node endpoints.
3. Exercises migration up/down/up, setup, authentication, two-node onboarding, encryption, health, audit, and controller/node independence.
4. Runs the frontend Vitest suite.

Because the target always supplies `TEST_DATABASE_URL` and both node URLs, the Release 0.1 integration workflow cannot silently skip.

For race detection against the same environment:

```bash
make test-local-race
```

For only the database/API workflow:

```bash
make test-integration
```

## Run the controller locally

Run these exact commands from the repository root:

```bash
make bootstrap
make test-env-up
. ./scripts/local-test-env.sh
make migrate
make build
make dev
```

The sourced script exports public, local-only fixtures and points the controller at:

| Service | Address or value |
|---|---|
| Controller | `http://127.0.0.1:8080` |
| PostgreSQL | `127.0.0.1:55432`, database/user `aghha` |
| Node A | `http://127.0.0.1:3101` |
| Node B | `http://127.0.0.1:3102` |
| Node username | `agh-admin` |
| Node password | `node-secret-value` |

In the browser:

1. Create `admin@example.test`, display name `Local Administrator`, password `local-controller-password`.
2. Create cluster `Local DNS`.
3. Add both node URLs using `Explicit plaintext HTTP` and the node credentials above.

The simulators implement only the authenticated `GET /control/status` contract used by Release 0.1. They are deterministic test dependencies, not DNS servers and not a substitute for the real-node release gate.

## Environment lifecycle

```bash
# Start or reconcile services and wait until healthy.
make test-env-up

# Stop containers but retain PostgreSQL data.
make test-env-down

# Remove containers and the disposable PostgreSQL volume.
make test-env-clean

# Remove all data, rebuild, and start a clean environment.
make test-env-reset
```

The Compose ports bind only to `127.0.0.1`. The test node containers are read-only, run as a non-root user, and contain no production credentials.

## Individual validation commands

With the environment running:

```bash
make fmt-check
make lint
make test-integration
make test-local-race
make build
npm --prefix web run typecheck
npm --prefix web run lint
npm --prefix web audit --omit=dev
```

## Production-style local configuration

`.env.example` remains the production-style template. The controller intentionally does not parse `.env` files. Generate fresh secrets, export the values into the process environment, and never use the committed local-test fixtures in a real installation.

`PUBLIC_BASE_URL` is the browser-visible origin only, for example `https://controller.example.test`; credentials, paths, queries, and fragments are rejected.

## Frontend delivery

The Go process serves `WEB_DIST_DIR` on the API origin. Development defaults to `web/dist`; systemd packaging uses `/usr/local/share/agh-ha-controller/web`. For hot reload, run `npm run dev` under `web/`; Vite proxies API and health routes to `http://127.0.0.1:8080`.
