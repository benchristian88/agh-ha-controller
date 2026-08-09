# ADR-0031: Use passphrase-encrypted portable controller backups and offline restore

Status: Accepted

Date: 2026-08-09

## Context

Recovery requires PostgreSQL state and the external credential-encryption key.
The database contains encrypted node credentials and notification destinations,
while Statistics, Query Log, DNS probes, and some HA history can be large and
are not required to recover desired state. A database dump without the original
key is incomplete, but placing that key unprotected beside the dump would expose
every portable secret.

Restoring the database underneath running workers cannot provide an unambiguous
rollback boundary. Runtime locations, database credentials, public URL, and
reverse-proxy TLS are installation-owned and must not be blindly copied from a
different host.

## Decision

Release 0.9 defines a versioned AGH HA Controller backup envelope. Its payload
is encrypted as one stream with the established `age` passphrase format and an
operator-supplied passphrase. The authenticated payload contains a PostgreSQL
custom-format dump, the credential-encryption key, an inner manifest, and
SHA-256 entry checksums. A bounded non-secret outer manifest supports early
format and compatibility inspection and must match the authenticated inner
manifest after decryption.

Standard Backup contains required control-plane state and excludes sessions,
release caches, Statistics, Query Log, DNS-probe history, and other explicitly
listed reconstructable operational history. Full Backup includes retained
operational history. Users, password hashes, roles, enabled state, audit
attribution, nodes, encrypted credentials, drafts, immutable revisions,
deployments, drift, lifecycle settings, upgrade continuity, and encrypted
notification configuration remain recovery data.

Creation uses `pg_dump` so concurrent activity is captured from a consistent
PostgreSQL snapshot. Restore is a controller-stopped administrative operation:
preflight validates bounds, archive structure, authenticated integrity, format,
source application/schema versions, required secret material, and target
compatibility before a new database is populated. `pg_restore` uses one
transaction; failure leaves the target empty and removes the newly created key
output. The existing database is retained until post-restore verification
succeeds. Offline authority is access to the stopped controller environment,
protected passphrase/database-URL files, empty target database, and
credential-key output.
The web application may
create/download backups and display preflight results, but it does not replace
its live database.

Sessions are not restored. The target installation keeps its session secret,
therefore all browsers must authenticate again. Installation-specific database
credentials, public URL, filesystem paths, and reverse-proxy TLS stay with the
target installation.

## Consequences

- A portable archive never contains usable plaintext secrets at rest.
- Losing both the backup passphrase and the installed credential key makes
  credentials unrecoverable by design.
- `pg_dump` and `pg_restore` matching the supported PostgreSQL major version are
  runtime/administrative prerequisites.
- Restore cannot be marketed as an ordinary online UI action.
- Archive limits, restrictive temporary permissions, checksum verification,
  audit records, and clean-install recovery tests are release gates.
