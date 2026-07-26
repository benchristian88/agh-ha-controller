# Local Development

## Planned prerequisites

- Go
- Node.js
- PostgreSQL
- Docker or Podman for local dependencies
- Two disposable AdGuard Home instances for integration testing

## Suggested commands

These commands are placeholders until build tooling is implemented.

```bash
make bootstrap
make db-up
make migrate
make test
make dev
```

## Local services

Suggested Docker Compose services:

- PostgreSQL.
- AdGuard Home Node A.
- AdGuard Home Node B.
- Optional mail test service later.

## Configuration

Copy:

```bash
cp .env.example .env
```

Generate strong local secrets.

Never commit `.env`.

## macOS notes

The repository can be copied anywhere under the user's home directory.

Example:

```bash
mkdir -p ~/Development
cd ~/Development
unzip ~/Downloads/agh-ha-controller.zip
cd agh-ha-controller
git init
```
