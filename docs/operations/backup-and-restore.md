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

Through Release 0.8, automated backup and restore commands were not implemented.
Releases 0.1 and 0.1.1 were declared complete after operator production-build
validation on 29 July 2026; the legacy PostgreSQL-native procedure remains
useful for diagnosing or recovering those installations. Release 0.9 adds the
portable workflow below.

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

## Release 0.9 portable recovery

System → Backup & Restore creates a Standard or Full `.aghhabackup` download.
Both require a new operator passphrase of at least 16 characters and protect the
database plus credential-encryption key as one authenticated `age` payload.
Standard excludes operational-history table data; Full includes it. Sessions
and release caches are never restored.

The Compose package provides a controller-owned work volume because the
read-only container and small `/tmp` tmpfs cannot hold a production dump. It is
temporary workspace, not backup retention: successful and failed operations
remove their restricted work directories, and the downloaded archive must be
stored and protected by the operator. Capacity-plan that volume for several
working copies of the custom dump while tar/encryption/envelope stages overlap.

Before relying on an archive, upload it to Restore preflight with its passphrase.
Preflight does not mutate PostgreSQL. Record its format, source application,
schema, type, creation time, included/excluded components, and size.

The CLI accepts passphrases only from a bounded `0600` regular file that is not
a symlink:

```bash
agh-ha-backup create --type standard --output controller.aghhabackup \
  --passphrase-file /run/aghha-backup-passphrase

agh-ha-backup preflight --archive controller.aghhabackup \
  --passphrase-file /run/aghha-backup-passphrase
```

Restore requires the controller to remain stopped and a separately created,
empty PostgreSQL database. It refuses any database with public tables and runs
`pg_restore` in one transaction. If restore fails, the database remains empty
and the newly written credential-key output is removed. Put the target URL,
including any database password, in its own bounded `0600` non-symlink file so
it never appears in process arguments:

```bash
agh-ha-backup restore --archive controller.aghhabackup \
  --passphrase-file /run/aghha-backup-passphrase \
  --target-database-url-file /run/aghha-restore-database-url \
  --credential-key-output /etc/agh-ha-controller/restored-credential.key \
  --confirm RESTORE_TO_EMPTY_DATABASE
```

Install the recovered key as `CREDENTIAL_ENCRYPTION_KEY`, point `DATABASE_URL`
at the restored database, preserve the target's session secret/public URL/TLS,
and restart. Keep the old database until administrator login, disabled accounts,
node credential decryption/connectivity, draft/revisions/active deployment,
drift, settings, collectors, and expected history are verified. Enforce should
remain disabled until desired and observed state have been reviewed.

### Docker Compose clean-install recovery

Keep the archive and both protected input files in a root-owned `0700` recovery
directory. Stop only the controller, create a new database alongside the old
one, and run the image's backup CLI as a one-off offline administration process:

```bash
docker compose stop controller
docker compose exec postgres createdb -U aghha aghha_restored
docker compose run --rm --no-deps --user 0:0 \
  --entrypoint agh-ha-backup \
  --volume "$PWD/recovery:/recovery" controller restore \
  --archive /recovery/controller.aghhabackup \
  --passphrase-file /recovery/passphrase \
  --target-database-url-file /recovery/database-url \
  --credential-key-output /recovery/restored-credential.key \
  --confirm RESTORE_TO_EMPTY_DATABASE
```

Use the actual Compose database user and a database URL whose host is
`postgres`. Put the recovered key value and restored database name into the
protected `.env`, then recreate only the controller. The temporary root user is
limited to this stopped-controller recovery command; the normal container
continues to run as UID/GID 10001 with a read-only root filesystem. Do not mount
the Docker socket into the controller.
