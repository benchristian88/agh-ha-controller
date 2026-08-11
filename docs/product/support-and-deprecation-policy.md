# Support and Deprecation Policy

AGH HA Controller remains pre-1.0 and unlicensed pending ADR-0020. This policy
describes current boundaries; it does not promise commercial support, warranty,
or an SLA.

- Only versions/platforms explicitly labeled **Tested** in the
  [compatibility matrix](../operations/compatibility-matrix.md) have completed
  recorded evidence. **Expected** is not a tested support guarantee.
- Create and preflight a portable backup before controller upgrades. Preserve
  installation runtime settings separately.
- Database migrations are append-only after release. Downgrade/rollback is
  supported only where an explicit procedure and compatible database state are
  documented.
- `/api/v1` is the intended stable browser/controller boundary, but pre-1.0
  contracts may change with migration notes. Database internals and secrets are
  never public API.
- Deprecations should appear in the changelog, retain a safe compatibility alias
  where practical, and provide a documented migration path before removal.
- Community triage and documentation are best-effort. Use the private reporting
  process in [SECURITY.md](../../SECURITY.md) for vulnerabilities.
- AdGuard Home versions outside the tested contract range may be observed as
  unknown, but affected managed writes remain blocked until reviewed.
- Release 1.0 support claims, technical rename compatibility, licensing, and
  contribution terms require separate evidence/decisions and are not implied by
  this policy.
