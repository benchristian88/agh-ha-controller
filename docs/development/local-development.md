# Local Development

## Prerequisites

- Go 1.24.
- Node.js 22 and npm.
- `make` and `rg`.
- PostgreSQL 17 when running database integration tests or the controller.

## Build and unit tests

```bash
make bootstrap
make fmt-check
make lint
make test
make test-race
make build
npm --prefix web run typecheck
```

The integration package skips when `TEST_DATABASE_URL` is absent. To require the PostgreSQL migration/API workflow, create an empty test database and run:

```bash
TEST_DATABASE_URL='postgres://user:password@127.0.0.1:5432/aghha_test?sslmode=disable' make test-integration
```

The integration test creates and removes an isolated schema. AdGuard Home status calls use bounded in-process HTTP fixtures unless explicit `TEST_NODE_A_URL` and `TEST_NODE_B_URL` values are supplied.

## Run from source

Build the frontend, export a real PostgreSQL URL and newly generated secrets, then start the controller:

```bash
make bootstrap
make build
export DATABASE_URL='postgres://aghha:password@127.0.0.1:5432/aghha?sslmode=disable'
export PUBLIC_BASE_URL='http://127.0.0.1:8080'
export SESSION_SECRET="$(openssl rand -base64 48)"
export CREDENTIAL_ENCRYPTION_KEY="$(openssl rand -base64 32)"
make dev
```

The controller intentionally does not parse `.env` files. Docker Compose reads the root `.env`; direct processes require exported variables or a service environment file.

## Frontend delivery

The Go process serves `WEB_DIST_DIR` on the API origin. Development defaults to `web/dist`; systemd and Docker use `/usr/local/share/agh-ha-controller/web`. For hot reload, run `npm run dev` under `web/`; Vite proxies API and health routes to `http://127.0.0.1:8080`.

## Production packaging checks

Copy `.env.example` to `.env`, replace every placeholder, then validate or build the production stack:

```bash
make compose-config
make compose-build
```

The direct-host path can be syntax-checked without installing:

```bash
bash -n scripts/install-systemd.sh
```
