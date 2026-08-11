# Install on Debian 13 with systemd

This is the authoritative native installation and upgrade guide. The reference
target is a Debian 13 host or unprivileged LXC with systemd.

## Requirements

- Git, Make, OpenSSL, Go 1.24, Node.js 22, and npm.
- PostgreSQL 17 server/client tools, including matching `pg_dump` and
  `pg_restore` major versions.
- Root access for provisioning the service and local database.
- An HTTPS browser-visible origin and controller-to-node administration API
  access.

## Install

```bash
git clone https://github.com/benchristian88/agh-ha-controller.git
cd agh-ha-controller
sudo PUBLIC_BASE_URL=https://controller.example.test ./scripts/install-systemd.sh
```

The installer builds the Go controller, backup CLI, and frontend; creates the
unprivileged `aghha` account and local PostgreSQL database; generates protected
runtime secrets; and installs `agh-ha-controller.service`. Reruns preserve
`/etc/agh-ha-controller/agh-ha-controller.env` and its secrets.

Terminate TLS with a trusted reverse proxy and route the browser origin to the
controller HTTP listener. `PUBLIC_BASE_URL` must match the externally visible
HTTPS origin so secure cookies and CSRF origin checks behave correctly.

## Verify

```bash
systemctl --no-pager --full status agh-ha-controller
journalctl -u agh-ha-controller --since '10 minutes ago'
curl --fail http://127.0.0.1:8080/health
curl --fail http://127.0.0.1:8080/ready
```

Open `PUBLIC_BASE_URL`, create the initial administrator, and complete the Setup
Guide. The controller service does not listen on a DNS port.

## Upgrade

1. Create and preflight a portable backup; retain the current environment file.
2. Read [CHANGELOG.md](../../CHANGELOG.md) and the compatibility matrix.
3. Fetch and select the intended tag or commit.
4. Rerun the installer with the same public origin.

```bash
git fetch --tags
git checkout <approved-version>
sudo PUBLIC_BASE_URL=https://controller.example.test ./scripts/install-systemd.sh
```

The installer restarts and verifies the service so the frontend and API cannot
remain on different builds. Confirm `/ready`, About metadata, active revision,
node connectivity, and collector recovery.

## Files and ownership

- `/usr/local/bin/agh-ha-controller` — controller/API/worker binary.
- `/usr/local/bin/agh-ha-backup` — offline backup administration CLI.
- `/usr/local/share/agh-ha-controller/web` — built frontend.
- `/etc/agh-ha-controller/agh-ha-controller.env` — root-owned runtime secrets.
- `/var/lib/agh-ha-controller` — restricted working state.
- `/etc/systemd/system/agh-ha-controller.service` — hardened service unit.

Do not copy the environment file into issue reports or logs.

## Back up and restore

Use System → Backup & Restore or `agh-ha-backup`. Restore is deliberately
offline: stop the controller and restore only into a new empty database. Follow
the [backup and restore procedure](../operations/backup-and-restore.md).

## Troubleshooting

- Installer reports missing commands: install every required build and
  PostgreSQL 17 utility before rerunning.
- Service fails after install: inspect `journalctl` and validate
  `DATABASE_URL`, `PUBLIC_BASE_URL`, and file permissions without printing
  secret values.
- Secure session fails: verify HTTPS termination and the exact public origin.
- Node operations fail: check controller-to-node HTTPS routing independently of
  client DNS routing.

See the [operations runbook](../operations/runbook.md) for runtime recovery.
