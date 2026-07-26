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
