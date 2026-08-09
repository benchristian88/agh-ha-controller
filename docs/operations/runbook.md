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

`/health` proves the process is serving and `/ready` additionally proves PostgreSQL connectivity. Deployment execution is visible in **HA Controller > Deployments** and continuing convergence incidents in **HA Controller > Drift**; query ingestion checks do not exist yet.

If readiness fails, the controller must not be treated as able to accept state changes. AdGuard Home DNS remains independent.

## Release 0.1 startup

Required runtime values:

- `DATABASE_URL`
- `PUBLIC_BASE_URL`
- `SESSION_SECRET` with at least 32 bytes of entropy
- `CREDENTIAL_ENCRYPTION_KEY`, base64 encoding exactly 32 bytes

Generate secrets with `openssl rand -base64 48` and `openssl rand -base64 32`. Store them in the protected systemd environment file and back them up separately from PostgreSQL.

`PUBLIC_BASE_URL` must be the externally visible origin without credentials, a path, query, or fragment. Its scheme controls the Secure attribute on browser cookies.

On startup the controller validates configuration, connects to PostgreSQL, applies embedded migrations when enabled, constructs security primitives, starts health/statistics/session workers, then opens HTTP. Any prerequisite failure stops startup.

`STATISTICS_POLL_INTERVAL` controls central statistics collection and defaults
to `1h`. Docker Compose passes it from `.env`; a direct/systemd installation
sets it in `/etc/agh-ha-controller/agh-ha-controller.env`. After adding it to an
existing preserved systemd environment file, restart the service. Keep the
interval comfortably above `NODE_REQUEST_TIMEOUT`; collection passes never
overlap.

## Statistics collection

Open **Statistics** and inspect **Node coverage**. The first usable snapshot
normally appears after the controller's immediate startup pass completes. The
fixed ranges reflect history retained by each AdGuard Home node, so a newly
installed controller can display earlier traffic without manufacturing data.

Common coverage reasons:

- `STATISTICS_EXACT_RANGE_UNSUPPORTED`: upgrade the node to a tested
  v0.107.72–v0.107.78 contract, or accept its explicit exclusion;
- `NODE_MAINTENANCE`: leave maintenance only when normal polling is intended;
- `STATISTICS_TIMEOUT` or `NODE_UNREACHABLE`: verify management-network access
  and the configured timeout;
- node authentication/TLS errors: repair the same stored credential or trust
  boundary used by other controller reads; and
- `STATISTICS_STALE`: the latest durable snapshot is older than the configured
  freshness threshold.

Controller downtime does not affect DNS. It pauses polls and can leave a gap.
Restart triggers an immediate pass, but history already expired from AdGuard
Home cannot be reconstructed. A node statistics reset is preserved as a real
discontinuity. Use `journalctl -u agh-ha-controller` or
`docker compose logs controller` for safe collection/storage diagnostics;
credentials, node URLs, and raw responses are not logged.

PostgreSQL retains snapshots, attempts, and hourly buckets for 32 days and
daily rollups for 400 days. Include these tables in normal PostgreSQL backups;
no separate telemetry volume exists.

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

1. Identify the failed node and inspect its per-node error detail in **HA Controller > Deployments**. `NODE_APPLY_FAILED` now includes the safe AdGuard Home method, operation path, and HTTP status, for example `POST /control/dhcp/set_config` with `HTTP 400`.
2. Confirm whether earlier nodes changed successfully.
3. Review verification result.
4. Decide:
   - Retry failed node.
   - Roll back changed nodes.
   - Pause and repair node.
5. Preserve deployment and audit history.

Release 0.3 stops after the first failed node and records `partially_succeeded` when an earlier node verified. It never silently rolls back. Repair the cause, then deliberately deploy the desired revision again or review and deploy a historical revision as rollback. A controller restart marks an in-flight attempt `interrupted`; re-observe all affected nodes before starting another deployment.

For systemd, correlate the deployment request ID with controller logs using `journalctl -u agh-ha-controller --since "30 minutes ago" --no-pager -o short-iso`. For Docker Compose, use `docker compose logs --since=30m --timestamps controller`. AdGuard Home may log additional validation context on the node; the common systemd command is `journalctl -u AdGuardHome --since "30 minutes ago" --no-pager -o short-iso`, while a containerised node can be inspected with `docker logs --since 30m --timestamps <container-name>`. Controller diagnostics deliberately exclude AdGuard response bodies and configuration payloads.

If DNS settings were applied before a DHCP failure, refresh the node before retrying. Release 0.4 applies DHCP after DNS. Already-converged disabled DHCP configuration is now left untouched while static leases still reconcile; a continuing `/control/dhcp/set_config` rejection therefore indicates a genuine desired/current DHCP difference that should be reviewed on the node-specific DHCP page.

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

## Release 0.6 Query Log operations

The controller polls immediately after startup and every
`QUERY_LOG_POLL_INTERVAL` (default 30 seconds), up to four nodes concurrently.
Use `/query-log` coverage to distinguish unsupported nodes, node-local logging
disabled, maintenance, stale collection, request failure, and known gaps. DNS
continues on every node during controller or ingestion failure.

Runtime controls are `QUERY_LOG_COLLECTION_ENABLED`, `QUERY_LOG_POLL_INTERVAL`,
and `QUERY_LOG_RETENTION`. The seven-day retention default is independent of
the node-local policy in General Settings. Disabling collection preserves
retained events until normal expiry. After changing systemd configuration,
restart the service; for Compose, recreate the controller container.

Investigate repeated gaps by comparing poll interval and DNS volume with the
10,000-record per-node pass bound, checking node-local retention/clear history,
and checking time synchronization. `QUERY_LOG_SOURCE_WINDOW_TRUNCATED` means
poll capacity was insufficient; shorten the interval. A retention gap or reset
cannot be reconstructed through the node API. `QUERY_LOG_CURSOR_STALLED` or
malformed-record gaps should be captured with node/controller versions, never
with credentials or raw household query history.

Monitor PostgreSQL database/index size and autovacuum. Budget roughly 1–3 GiB
per million events including indexes and headroom, then validate against actual
traffic. Cleanup is bounded to 10,000 events and attempts per pass; failure is
logged and retried on the next poll without stopping ingestion.
The 29 July 2026 production validation completed both Docker and systemd installs successfully. A non-fatal `make: rg: no such file or directory` message on systemd came from Make source discovery; Release 0.2 uses portable `find` and does not require ripgrep for installation.

## Release 0.2 configuration inventory checks

1. Open **Configuration** for the selected cluster.
2. Refresh each enabled node; confirm DNS and filtering capabilities and a successful immutable snapshot.
3. Compare equivalent nodes and confirm semantic equality.
4. Introduce or identify one safe real difference and confirm its section and ownership scope.
5. Review and import one snapshot; confirm the inventory draft version increments and audit contains `configuration.draft_imported`.
6. Confirm no node configuration changed. Release 0.2 has no writer or deployment route.

## Release 0.3 authoritative configuration checks

1. Refresh and import every enabled node so each has a `nodeOverrides` listener identity.
2. Edit and save the shared draft, validate it, add a summary, and publish an immutable revision.
3. Preview and deploy it. Confirm each node task reaches `succeeded`, has a verification snapshot, and the revision becomes active only after the final node verifies.
4. Make a safe direct shared-field change on one AdGuard Home node. Confirm one open drift event appears with a structured difference.
5. Under Manual or Alert, confirm no automatic mutation. Under Enforce, confirm a reconciliation deployment restores the value and a later observation resolves the event.
6. Put a node in maintenance and confirm it is excluded from deployment/reconciliation targets. Remove maintenance and revalidate before deploying.
7. Publish a second revision, then use Rollback on the first. Confirm rollback creates a new deployment record and does not modify either revision.

If validation reports a missing/invalid DNS port or bind address after upgrading from the initial 0.3.0 build, refresh that node and import its new successful snapshot. Repeat for every enabled node named by validation; pre-fix snapshots did not collect listener identity from the correct AdGuard Home endpoint. Because import replaces shared draft values with the selected snapshot, review and reapply the intended shared edits after the final recovery import.

Release 0.3, including Docker and systemd installation and functional validation, was completed by the operator on 30 July 2026.

## Release 0.4 broader configuration checks

The operator completed Release 0.4 functional, Docker-installation, and
native/systemd-installation validation on 3 August 2026. The procedure below is
retained for repeatable upgrades and incident diagnosis; it is no longer an
open Release 0.4 completion gate.

1. Upgrade PostgreSQL through migration `000004_release_0_4` and confirm existing schema-v1 revisions still compare, preview, roll back, and reconcile.
2. Refresh every node. v0.107.52 must report schema v1 with an upgrade warning; v0.107.53–v0.107.78 must report schema v2 and explicit patch-level feature flags. A newer unverified contract must report unknown and block deployment.
3. Import every enabled v2 node, then exercise `/settings/general`, `/settings/dns`, `/settings/encryption`, `/settings/clients`, `/settings/dhcp`, `/filters/blocklists`, `/filters/allowlists`, `/filters/rewrites`, `/filters/blocked-services`, and `/filters/custom-rules`. Save, publish from Configuration Control, deploy to two nodes, and confirm managed-field read-back convergence.
4. On DNS Blocklists, confirm existing desired URLs appear as rows and inspect
   node-attributed names, rule counts, last-update times, and application state.
   Refresh all blocklists and then allowlists. Confirm a requested and terminal
   audit event per node and an explicit partial result if one node fails.
   Selected-row blocklist refresh must remain unavailable unless a future
   supported AdGuard Home request can identify URLs or filter IDs.
5. Confirm TLS inventory shows status/subject/issuer/validity only. Search API output, snapshots, audit metadata, and logs for certificate/key test markers and confirm none exist.
6. Configure DHCP on two node overrides but enable only one. Confirm validation rejects two enabled nodes. For a handoff revision, confirm the deployment order disables the old node before enabling the new node and records both per-node results.
7. Change a schema-v2 managed setting directly and confirm drift; change only TLS status or a dynamic lease and confirm no drift.

If a v2 deployment is blocked, inspect the node capability profile and successful current observation. Do not bypass the gate: upgrade the node, restore endpoint access, refresh, and re-import. TLS changes must be made in the native node UI while the node is in maintenance, followed by refresh and deliberate adoption.

## Release 0.7 Operational Status

Use **Administration -> Operational Status** before querying PostgreSQL or
searching logs. Connectivity and full observation are separate: a node API may
be reachable while its configuration snapshot is stale. Statistics and Query
Log reuse their established freshness rules and known source gaps are explicit.

For a failed collector, check the safe code, last success, lag, failure streak,
and next attempt. Confirm maintenance and compatibility, then inspect logs for
the same subsystem/node ID. Logs must not contain credentials, query contents,
or raw responses. Healthy-node polls continue when another node fails.

Retention failures are separate worker states and do not stop collection.
Statistics and Query Log deletion are bounded to 10,000 rows per dataset/pass.
Check free disk, locks, autovacuum, and PostgreSQL logs; do not routinely run
`VACUUM FULL`. A successful run clears the worker failure streak.

- `/health` is process liveness and does not fail for stale collectors.
- `/ready` is PostgreSQL-aware readiness and is the Docker health check.
- `/api/v1/clusters/{clusterId}/operational-status` is authenticated detail.
- `/metrics` is disabled by default. Configure a random minimum-32-character
  `METRICS_BEARER_TOKEN`, restart, use it as the Prometheus bearer token, and
  restrict port 8080 with host or reverse-proxy policy.

PostgreSQL sizes are metadata estimates: monitor trends, autovacuum and index
growth, run normal `ANALYZE`, and test backup/restore duration as data grows.
