# Compatibility Matrix

Status labels are deliberately narrow: **tested** means a release gate has
recorded evidence, **expected** means supported architecture without complete
matrix evidence, and **unsupported** means the controller must not claim it.

| Area | Version/platform | Status | Notes |
|---|---|---|---|
| AdGuard Home | v0.107.52 | Tested | Frozen configuration schema v1. |
| AdGuard Home | v0.107.53–v0.107.78 | Tested contract; selected real-node gates | Schema v2 with explicit patch capabilities. |
| AdGuard Home | Newer/unreviewed contracts | Unsupported until reviewed | Inventory reports unknown; managed deployment is blocked. |
| PostgreSQL | 17 | Tested/reference | Docker and CI baseline; matching `pg_dump`/`pg_restore` required. |
| PostgreSQL | Other majors | Unsupported for 0.9 | No compatibility claim without migration/backup evidence. |
| Native | Debian 13 with systemd | Tested/reference | Source-build installer. |
| Docker | Docker Engine with Compose v2 | Tested/reference | No Docker socket or privileged controller access. |
| Browser | Current Chromium desktop/mobile | Tested | Automated DOM/accessibility plus packaged browser validation. |
| Browser | Current Firefox and Safari/iOS | Expected | Standards-based UI; complete manual matrix remains a 0.9 release gate. |
| Upgrade | 0.8 → 0.9 | Supported after release validation | Append-only migration 000013; backup required. |
| Upgrade | Earlier than 0.8 → 0.9 | Expected through append-only migrations | Must be explicitly tested before advertised as supported. |
| Backup restore | 0.9 format v1 to compatible 0.9+ schema | Supported design | Future app/schema backups are rejected. |

The stable 1.0 support statement must be based on completed evidence rather
than widening these ranges by assumption.
