# Database Migrations

Ordered PostgreSQL migrations and their embedded Go filesystem live in this directory.

The controller applies pending migrations on startup when `AUTO_MIGRATE=true`. Operators can also run:

```bash
make migrate
make migrate-down # development only; rolls back one migration
```

Applied versions and SHA-256 checksums are stored in `schema_migrations`. A changed checksum causes startup to fail rather than silently accepting an edited released migration.

Do not edit a migration after it has been included in a released version.
