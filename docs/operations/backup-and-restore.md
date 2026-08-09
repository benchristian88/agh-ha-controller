# Backup and Restore

## Required backup items

- PostgreSQL database.
- Credential encryption key.
- Session secret.
- Runtime environment configuration.
- Controller TLS material.
- Installation version.

## Backup frequency

Suggested initial policy:

- Database: daily.
- Encryption key: after creation and every rotation.
- Configuration files: after change.
- Pre-upgrade backup before every release upgrade.

## Restore validation

A backup is not considered valid until:

- PostgreSQL restores successfully.
- Controller starts.
- Revisions are readable.
- Credentials decrypt.
- Nodes can be observed.
- Enforcement can remain disabled during validation.

Release 0.1 has no configuration enforcement, so restore validation is observation-only by construction. A 0.1 restore must additionally confirm that an existing browser session is invalid if `SESSION_SECRET` changed and that stored node credentials decrypt only when the original credential key is restored.

Automated backup and restore commands are not implemented. Releases 0.1 and 0.1.1 were declared complete after operator production-build validation on 29 July 2026; this manual procedure remains the supported recovery path and automated restore verification remains follow-on operational work.

For Docker Compose, back up PostgreSQL from the `postgres-data` volume with PostgreSQL-native tooling and preserve the untracked `.env`. For systemd, use PostgreSQL-native tooling and preserve `/etc/agh-ha-controller/agh-ha-controller.env`. A database without its original credential encryption key cannot decrypt stored node credentials.

## Release 0.7 operational-history policy

Configuration/revisions, deployments, drift, node state, users, credentials,
and audit records are essential. Statistics and Query Log are operational
history: include them in the default whole-database backup, but they may be
deliberately excluded when size or recovery time requires it. Losing them
removes history and may create a Query Log gap; it does not change desired
configuration or stop DNS. Reset checkpoints consistently if events are
excluded.

After restore, verify `/ready`, open Operational Status, read the active
revision/deployments, test one node credential, refresh an observation, and
confirm new Statistics and Query Log records arrive. Keep Enforce disabled
until desired and observed state are reviewed. Record restore duration,
database size, excluded tables, and resulting freshness/gap behavior.
