# AGH HA Controller

AGH HA Controller is a central controller for managing, observing, and operating
multiple AdGuard Home nodes as a consistent highly available DNS service while
remaining outside the DNS request path.

AdGuard Home continues to answer DNS independently. The controller supplies the
management plane: one desired configuration, verified deployment, drift
detection, node-attributed visibility, lifecycle coordination, and audit
history. If the controller or PostgreSQL is unavailable, the nodes continue to
serve DNS with their last applied configuration.

> AGH HA Controller is an independent project for managing AdGuard Home. It is
> not an official AdGuard product and is not endorsed by AdGuard Software Ltd.

## What it provides

- Authoritative shared configuration with explicit node-specific values.
- Immutable revisions, comparison, verified sequential deployment, rollback,
  drift detection, and reconciliation policies.
- Node inventory, capability awareness, active DNS health, maintenance safety,
  DHCP ownership checks, certificate/version visibility, and guided upgrades.
- Aggregated cluster/node Statistics and a centrally retained, node-attributed
  Query Log.
- Operational Status, audit history, webhook notifications, and bounded data
  retention.
- Multiple local administrators, encrypted node credentials, portable encrypted
  backups, offline restore, setup guidance, and host-guided controller updates.
- Responsive System/Light/Dark operator interface and installable web-app
  metadata.

The [feature catalogue](docs/reference/features.md) is the authoritative list of
current capabilities and boundaries.

## Architecture

```text
Browser
  → AGH HA Controller API and workers
      → PostgreSQL
      → AdGuard Home administration APIs

DNS clients
  → AdGuard Home nodes directly
```

The controller never proxies normal DNS queries, never requires a node-side
agent, and never owns the host upgrade mechanism. Configuration moves through a
controlled lifecycle:

```text
draft → validation → immutable revision → deployment → verification
      → active revision → drift detection/reconciliation
```

See the [architecture overview](docs/architecture/architecture.md) and
[security guide](docs/security/security.md) for the operating boundaries.

## Quick start with Docker Compose

Requirements: Git, Docker Engine, Docker Compose v2, and OpenSSL.

```bash
git clone https://github.com/benchristian88/agh-ha-controller.git
cd agh-ha-controller
cp .env.example .env
openssl rand -hex 24
openssl rand -base64 48
openssl rand -base64 32
```

Put the generated values in `.env` as `POSTGRES_PASSWORD`, `SESSION_SECRET`,
and `CREDENTIAL_ENCRYPTION_KEY`. Set `PUBLIC_BASE_URL` to the HTTPS URL used by
browsers, then start the stack:

```bash
docker compose up --build --detach
docker compose ps
```

Open `PUBLIC_BASE_URL` and create the initial administrator. The complete
procedure, upgrade steps, and recovery checks are in the
[Docker guide](docs/getting-started/docker.md).

For the Debian 13/systemd reference installation, use the
[native installation guide](docs/getting-started/native-systemd.md).

## Supported environments

- AdGuard Home v0.107.52 on frozen configuration schema v1.
- AdGuard Home v0.107.53–v0.107.78 on configuration schema v2, subject to
  explicit per-version capabilities.
- PostgreSQL 17.
- Debian 13 with systemd, or Docker Engine with Compose v2.
- Current Chromium is the completed browser baseline. Firefox and Safari/iOS
  remain expected rather than fully release-validated.

Newer AdGuard Home contracts are reported as unknown and blocked from managed
deployment until reviewed. Consult the
[compatibility matrix](docs/operations/compatibility-matrix.md) for precise
evidence labels and the [support policy](docs/product/support-and-deprecation-policy.md)
for pre-1.0 boundaries.

## Documentation

- [Documentation home](docs/README.md)
- [User guide](docs/user-guide/overview.md)
- [Administration guide](docs/administration/administration.md)
- [Operations runbook](docs/operations/runbook.md)
- [Backup and restore](docs/operations/backup-and-restore.md)
- [API reference](docs/api/controller-api.md)
- [Architecture decisions](docs/decisions/README.md)
- [Development and testing](docs/development/local-development.md)
- [Changelog](CHANGELOG.md) and [forward roadmap](docs/roadmap/roadmap.md)

## Security

Deploy the controller behind HTTPS, protect its runtime environment and backup
passphrases, and treat Query Log data as sensitive. Browser mutations require an
authenticated administrator session and CSRF token. The controller does not
mount the Docker socket or execute upgrade instructions. See [SECURITY.md](SECURITY.md)
for reporting and [the security guide](docs/security/security.md) for controls.

## Project status

This repository is a pre-1.0 development product. The current tree targets
`0.9.2-dev`, the final product-polish release before the planned technical name
and brand migration. The technical name remains **AGH HA Controller** throughout
0.9.2; `Atlas` references are visual-source identifiers only.

Automated local checks cover the current implementation, but inherited packaged
Firefox, Safari/iOS, Docker, systemd, real-node, and PostgreSQL release evidence
is still tracked in the validation records. Do not interpret the development
version as a production support guarantee.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), the
[coding standards](docs/development/coding-standards.md), and the
[testing guide](docs/development/testing.md). Changes must preserve DNS-path
independence, revision/audit history, secret handling, and documented failure
behavior.

## Licence

No licence has been selected. The repository is not offered under an open-source
licence, and no rights are granted beyond those provided by applicable law.
ADR-0020 records the pending legal and commercial decision. Do not submit
external contributions until contribution and licence terms are established.
