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

Automated backup and restore commands are not implemented in 0.1. The release gate requires a manual PostgreSQL plus runtime-secret smoke test on the reference Debian LXC before the release can be declared complete.

For Docker Compose, back up PostgreSQL from the `postgres-data` volume with PostgreSQL-native tooling and preserve the untracked `.env`. For systemd, use PostgreSQL-native tooling and preserve `/etc/agh-ha-controller/agh-ha-controller.env`. A database without its original credential encryption key cannot decrypt stored node credentials.
