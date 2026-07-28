# Operational Runbook

## Controller health

Check:

- `/health`
- `/ready`
- PostgreSQL connectivity.
- Background worker status.
- Recent failed jobs.
- Disk capacity.
- Query ingestion lag.

For Release 0.1, `/health` proves the process is serving and `/ready` additionally proves PostgreSQL connectivity. Query ingestion and deployment checks do not exist yet.

If readiness fails, the controller must not be treated as able to accept state changes. AdGuard Home DNS remains independent.

## Release 0.1 startup

Required runtime values:

- `DATABASE_URL`
- `PUBLIC_BASE_URL`
- `SESSION_SECRET` with at least 32 bytes of entropy
- `CREDENTIAL_ENCRYPTION_KEY`, base64 encoding exactly 32 bytes

Generate secrets with `openssl rand -base64 48` and `openssl rand -base64 32`. Store them in the protected systemd environment file and back them up separately from PostgreSQL.

`PUBLIC_BASE_URL` must be the externally visible origin without credentials, a path, query, or fragment. Its scheme controls the Secure attribute on browser cookies.

On startup the controller validates configuration, connects to PostgreSQL, applies embedded migrations when enabled, constructs security primitives, starts health/session workers, then opens HTTP. Any prerequisite failure stops startup.

## Release 0.1.1 installation checks

For Docker Compose, run `docker compose ps`, inspect `docker compose logs --tail=100 controller`, and request `/ready`. Both services must be healthy. PostgreSQL state is in the `postgres-data` named volume; runtime secrets are in the untracked `.env` and must be backed up separately.

For systemd, run `systemctl status agh-ha-controller`, inspect `journalctl -u agh-ha-controller`, and request `/ready`. The runtime environment is `/etc/agh-ha-controller/agh-ha-controller.env` with mode `0600`; the installer preserves it during an upgrade rerun.

Release 0.2.2 and later restart and verify the unit after installing new artifacts. On an earlier upgrade, a new frontend combined with `API route was not found` indicates the old controller process is still running; use `systemctl restart agh-ha-controller` and verify `/api/v1/system/version` before retrying.

Before either upgrade path, back up PostgreSQL and runtime secrets. A failed migration prevents controller startup and leaves DNS nodes serving independently. On a database with no users, opening the UI starts the one-time administrator flow. After creation, setup status is false and repeated setup requests return conflict.

## Node status error codes

- `NODE_UNREACHABLE`: network or timeout failure.
- `NODE_TLS_FAILED`: certificate, hostname, or TLS failure.
- `NODE_AUTHENTICATION_FAILED`: AdGuard Home rejected credentials.
- `NODE_INVALID_RESPONSE`: status endpoint was incompatible or malformed.
- `NODE_DNS_NOT_RUNNING`: the administration API responded but reported DNS stopped.

Correct the underlying issue and use “Test” in the Nodes page. Direct AdGuard Home DNS operation should be checked independently before changing or removing a node.

## Node unreachable

1. Confirm node network reachability.
2. Confirm AdGuard Home is serving DNS.
3. Confirm administration API is listening.
4. Confirm credentials.
5. Confirm TLS certificate.
6. Check node maintenance state.
7. Review recent controller changes.
8. Do not remove the node solely to clear the alert.

## Drift detected

1. Review structured diff.
2. Identify expected or unexpected change.
3. Choose:
   - Restore.
   - Adopt into draft.
   - Ignore field.
   - Maintenance.
4. Confirm final convergence.

## Failed deployment

1. Identify failed node and phase.
2. Confirm whether earlier nodes changed successfully.
3. Review verification result.
4. Decide:
   - Retry failed node.
   - Roll back changed nodes.
   - Pause and repair node.
5. Preserve deployment and audit history.

## Controller restore

1. Restore database.
2. Restore encryption key.
3. Start in observation-only mode.
4. Validate every node.
5. Confirm active desired revision.
6. Confirm observed state.
7. Re-enable enforcement.

## Diagnostic bundle

A future diagnostic command should include:

- Controller version.
- Database schema version.
- Node versions and capabilities.
- Redacted configuration metadata.
- Recent job errors.
- Deployment state.
- Metrics.

It must exclude:

- Passwords.
- Session tokens.
- Node credentials.
- TLS private keys.
- Raw query logs by default.
The 29 July 2026 production validation completed both Docker and systemd installs successfully. A non-fatal `make: rg: no such file or directory` message on systemd came from Make source discovery; Release 0.2 uses portable `find` and does not require ripgrep for installation.

## Release 0.2 configuration inventory checks

1. Open **Configuration** for the selected cluster.
2. Refresh each enabled node; confirm DNS and filtering capabilities and a successful immutable snapshot.
3. Compare equivalent nodes and confirm semantic equality.
4. Introduce or identify one safe real difference and confirm its section and ownership scope.
5. Review and import one snapshot; confirm the inventory draft version increments and audit contains `configuration.draft_imported`.
6. Confirm no node configuration changed. Release 0.2 has no writer or deployment route.
