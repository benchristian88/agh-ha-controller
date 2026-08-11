# 1.0 Support and Deprecation Policy Draft

AGH HA Controller remains pre-1.0 and unlicensed pending ADR-0020. This document
prepares the operational policy and does not promise commercial support.

- Supported AdGuard Home, PostgreSQL, platform, browser, and upgrade ranges are
  those explicitly labelled supported/tested in the compatibility matrix.
- Operators must create and verify a portable backup before controller upgrades.
- Database migrations are append-only after release; downgrade is supported only
  where a documented migration rollback and platform procedure exist.
- `/api/v1` is the intended stable browser/controller boundary for 1.0. Pre-1.0
  contracts may change with migration and release notes; secrets and database
  implementation details are never API surface.
- Deprecations should be announced in release notes, retain compatibility aliases
  where safe, and provide at least one documented migration path before removal.
- Security reports should use a private repository security-advisory channel once
  enabled; public issues must never contain credentials or private query data.
- Community issue triage and documentation are best-effort. No SLA, managed
  service, warranty, or commercial support commitment is made.
- Release 1.0 owns the deliberate AGH HA Controller → Atlas DNS Controller rename,
  compatibility aliases, migration testing, and final support guarantee.
