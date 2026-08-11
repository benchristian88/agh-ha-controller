# Release 0.7 Validation

## Implemented automated coverage

- Worker tracker failure threshold and recovery reset.
- Existing node-isolation, timeout, cancellation, Statistics, Query Log,
  deployment, drift, retention, API authentication, and safe-error regressions.
- Metrics disabled/unauthorized/authorized behavior, bounded label, and no
  error-text exposure.
- Operational Status healthy/degraded aggregation through package tests and UI
  degraded/gap/storage/loading/error rendering.
- Canonical route and Administration navigation.
- Full Go and React regressions, typecheck, Biome, accessibility suite, and
  production build.

## Release gates

Before marking 0.7 complete, run and record:

```bash
make fmt-check
make test
make test-race
make lint
make build
make compose-config
make compose-build
TEST_DATABASE_URL=... make test-integration
```

Then validate an upgrade from migration 000010, two real nodes with one
collector failure/recovery, PostgreSQL readiness failure, bounded cleanup on a
large dataset, protected Prometheus scrape, mobile/desktop light/dark status
views with no console errors, backup/restore, Docker install/upgrade, and the
native systemd install/upgrade. DNS must continue throughout controller and
database outage tests.

The source implementation must not be described as a completed Release 0.7
until those external/package gates are recorded. Releases 0.5 and 0.6 are
already complete and validated and are regression dependencies, not reopened
release gates.

## Local result — 9 August 2026

Passed: Go unit/integration-package suite, uncached race suite, `go vet`, Go and
Biome format checks, frontend typecheck/lint, 217 Vitest tests including axe
coverage for Operational Status, frontend/native production build, systemd
installer shell syntax, Compose YAML parsing, and production npm audit (zero
vulnerabilities).

Not run on this host: Docker Compose config/image execution (`docker` is not
installed), a real `TEST_DATABASE_URL` migration/query-plan run, authenticated
packaged Chrome light/dark/mobile captures, real-node failure/recovery, and
systemd installation as root. These remain explicit release gates; 0.7 is not
marked complete.
