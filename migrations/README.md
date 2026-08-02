# Database Migrations

Ordered PostgreSQL migrations and their embedded Go filesystem live in this directory.

The controller applies pending migrations on startup when `AUTO_MIGRATE=true`. Operators can also run:

```bash
make migrate
make migrate-down # development only; rolls back one migration
```

Applied versions and SHA-256 checksums are stored in `schema_migrations`. A changed checksum causes startup to fail rather than silently accepting an edited released migration.

Do not edit a migration after it has been included in a released version.

Released schema milestones:

- `000001_release_0_1`: authentication, clusters, nodes, encrypted credentials, and audit.
- `000002_release_0_2`: capabilities, immutable observations, and optimistic inventory drafts.
- `000003_release_0_3`: desired documents, immutable revisions, durable deployments, applied state, reconciliation, maintenance, and drift history.
- `000004_release_0_4`: schema-v2 configuration records while preserving immutable schema-v1 history.
- `000005_release_0_4_1_dhcp_operations`: durable, idempotent DHCP operational commands and per-node results.
- `000006_release_0_4_1_dns_operations`: encrypted-input, durable fleet DNS operational commands and per-node results.
- `000007_release_0_4_1_host_filter_operation`: encrypted-input, durable host-filtering tests and bounded per-node rule results.
