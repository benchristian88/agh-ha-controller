# Release 0.6 Validation

Date: 9 August 2026

## Implemented scope

Release 0.6 implements the API-polling combined Query Log described in
`docs/backend/query-ingestion.md`: source normalization and cursor paging,
durable PostgreSQL events/checkpoints/attempts, conservative deduplication,
bounded retention, authenticated search/filter/detail APIs, explicit coverage,
the responsive Query Log page, and draft-only contextual authoring handoffs.
Query events remain outside desired configuration, revision, deployment, and
drift records.

## Local automated evidence

- `go test ./...`: pass.
- `go test -race -count=1 ./...`: pass.
- `go vet ./...`: pass.
- `make build GO=web/node_modules/.cache/aghha-go/go/bin/go`: pass; controller,
  migrator, and production frontend built with version 0.6.0.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test -- --run`: pass, 214 tests across 37 files.
- `npm run build`: pass.
- `npm audit --omit=dev`: zero vulnerabilities.
- `bash -n scripts/install-systemd.sh`: pass.
- `git diff --check`: pass.

The Go integration package compiles and runs, but PostgreSQL-dependent cases
skip when `TEST_DATABASE_URL` is absent. Release 0.6 adds an upgrade/rollback/
reapply schema test that checks the three tables, identity/pagination/search
indexes, and prohibited sensitive columns when that environment is supplied.

## Browser evidence

The production Vite build was rendered through a temporary same-origin
controller fixture in headless Chrome at 1440×1000 and 500×900. Both showed the
canonical route, global scope, required Node column, filters, partial coverage,
bounded table, and responsive navigation without application console errors.
The mobile table remains horizontally scrollable instead of dropping node or
explanation columns. Query Log component tests additionally cover light/dark
themes, 390/1440 widths, keyboard disclosure semantics, and Axe WCAG A/AA
structure.

Chrome emitted host updater/certificate-store diagnostics unrelated to the
application. No browser request targets `/control/`; all node reads remain in
the backend adapter.

## External gates still required before tagging complete

This macOS host has no Docker CLI, PostgreSQL server/client, or systemd. The
following acceptance evidence therefore remains an operator release gate and
is not marked complete by the source implementation:

1. Run `TEST_DATABASE_URL=... go test -v -count=1 ./tests/integration` against
   PostgreSQL 17, including 0.5-to-0.6 migration/rollback/reapply.
2. Exercise two supported AdGuard Home nodes across success, one-node outage,
   controller restart, node clear/reset, logging disabled, anonymisation,
   local-retention loss, clock regression, and volume exceeding one page.
3. Verify search/pagination and stored growth/query plans against realistic
   retained volume, then observe bounded cleanup and autovacuum.
4. Run authenticated packaged light/dark desktop/mobile workflows and confirm
   allow/block/rewrite Save Draft never publishes or deploys automatically.
5. Build/upgrade/restore with Docker Compose and the Debian 13 systemd reference
   installer; confirm DNS continues while the controller is stopped.

Release documentation and the feature ledger deliberately say “external
release gates pending” until this evidence is supplied. The source tree is
locally push-ready, but the 0.6.0 release tag should wait for those gates.
