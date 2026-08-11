# Release 0.9.2 Validation Record

This is a point-in-time development evidence record, not current product
documentation. Release status remains constrained by the inherited external
0.9/0.9.1 gates.

## Scope

- Node Detail common layout, lifecycle information architecture, responsive and
  accessibility contracts.
- Complete webhook administration and secret/history safety.
- Revision/deployment archive and narrowly eligible hard deletion.
- Product documentation consolidation and Release 1.0 rename inventory.
- Regression of the existing control plane, productization, theme, menu, backup,
  user administration, and HA operations behavior.

## Local automated evidence

Completed on 11 August 2026 (Pacific/Auckland):

| Gate | Result |
|---|---|
| Full Go suite | Passed with `go test -count=1 ./...`; loopback `httptest` cases required the permitted host network namespace. |
| Go race | Full suite passed during the release pass; after the final webhook/integration changes, all changed backend/database/integration packages passed an uncached `-race -count=1` run. |
| Go static/build | `go vet ./...` passed; controller, migrator, backup CLI, and frontend built with aligned `0.9.2-dev` metadata. |
| Frontend | 44 Vitest files / 237 tests passed; TypeScript and Biome passed; production Vite build passed with the existing >500 kB chunk advisory. |
| Theme/brand/PWA regression | Asset/manifest validator passed without changing the technical naming boundary. |
| Documentation | Local file and Markdown-anchor validator passed all 123 Markdown files; current-doc release-framing and in-app placeholder/development-copy scans passed. |
| Packaging syntax | systemd installer and release-artifact shell syntax passed. Docker Compose config could not run because Docker is unavailable on this host. |
| Dependency audit | `npm audit --omit=dev` reported zero vulnerabilities. |
| Repository | `git diff --check` passed; no technical Atlas rename or tracked root scratch artifact was introduced. |

The frontend total includes common Node Detail loading/error/layout/link/Axe
coverage, complete webhook UI lifecycle, and revision/deployment action wording
and eligibility. Backend tests cover webhook preserve/replace/redaction/test/audit,
administrator/CSRF route guards, confirmation/audit, and lifecycle service rules.
The PostgreSQL integration test compiles in every Go run but was explicitly
skipped locally because `TEST_DATABASE_URL` is unset.

## Environment-gated evidence

- PostgreSQL 17 migration and `tests/integration/release_0_9_2_test.go`: compiled
  and skipped because `TEST_DATABASE_URL` is unset. The test covers active and
  deployed revision conflicts, archive visibility/restore, unused deletion,
  terminal deployment archive/restore, started/unstarted deletion boundaries,
  and webhook delivery/event retention.
- Docker Compose clean install/upgrade/backup/restore: pending on a Docker host.
- Debian 13/systemd clean install/upgrade/backup/restore: pending on the reference
  platform.
- Supported real AdGuard Home node lifecycle/webhook integration: pending.
- Current packaged Chromium/Firefox/Safari/iOS desktop/tablet/mobile visual,
  overflow, focus, touch, PWA, and favicon matrix: pending.

Local success must not be interpreted as completion of these external gates.
