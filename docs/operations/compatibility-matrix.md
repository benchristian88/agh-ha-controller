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
| Browser | Current Chromium desktop/mobile | Tested baseline | Automated DOM/accessibility and recorded packaged evidence; recheck for each release. |
| Browser | Current Firefox and Safari/iOS | Expected | Standards-based UI; inherited manual matrix remains open. |
| Upgrade | 0.9.1 → 0.9.2 | Expected pending packaged gate | Append-only migration 000014; preflighted backup required. |
| Upgrade | Earlier pre-1.0 versions → 0.9.2 | Expected through append-only migrations | Must be explicitly tested before advertised as supported. |
| Backup restore | Format v1 to a compatible current schema | Supported design; external matrix pending | Future application/schema backups are rejected. |

The matrix records contract scope, not official AdGuard endorsement. The stable
1.0 support statement must be based on completed evidence rather than widening
these ranges by assumption.
