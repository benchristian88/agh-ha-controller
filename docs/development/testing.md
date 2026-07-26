# Testing Strategy

## Unit tests

Target:

- Canonicalisation.
- Configuration merging.
- Diff generation.
- Capability validation.
- Reconciliation state transitions.
- Retry classification.
- Aggregation calculations.
- Secret redaction.

## Integration tests

Use real PostgreSQL.

Use real or containerised AdGuard Home versions for:

- Authentication.
- Status.
- Configuration reads.
- Configuration writes.
- Query log.
- Statistics.
- Compatibility behaviour.

## Contract tests

Keep fixtures for tested AdGuard Home API versions.

Detect unexpected payload changes.

## End-to-end tests

Critical workflows:

1. First login.
2. Add two nodes.
3. Import configuration.
4. Create revision.
5. Deploy revision.
6. Detect drift.
7. Restore drift.
8. Roll back revision.
9. Search combined query log.

## Failure tests

- Node timeout.
- Wrong credentials.
- One node fails during deployment.
- Controller restarts during deployment.
- Database connection loss.
- Unsupported node version.
- Verification mismatch.
- Forwarder duplicate delivery.

## Migration tests

For every released schema:

- Upgrade from previous version.
- Preserve data.
- Start application.
- Run smoke workflow.
