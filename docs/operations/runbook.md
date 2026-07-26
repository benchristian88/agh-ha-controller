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
