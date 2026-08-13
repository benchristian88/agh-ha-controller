# Release 1.0 Readiness Record

Date: 2026-08-12  
Candidate state: implementation complete locally; external release gates open

The product owner confirmed Release 0.9.2 complete, tested, and accepted before
the 1.0 rename began. Release 1.0 remained under feature freeze: this candidate
contains identity, stability, documentation, licensing, and release-engineering
work, not a new DNS/controller feature area.

## Completed local evidence

| Gate | Result | Evidence |
|---|---|---|
| Go module/build identity | Pass | Module/imports and linker paths use `github.com/benchristian88/atlas-dns`; `go mod tidy`, `go vet ./...`, and native build passed. |
| Go unit/contract regression | Pass | `go test ./...` passed all runnable packages; the PostgreSQL integration package skipped without `TEST_DATABASE_URL`. |
| Race detection | Pass | `go test -race -count=1 ./...` passed all runnable packages. |
| Frontend regression/accessibility | Pass | 44 test files and 238 tests passed, including Axe, theme, shell/menu, lifecycle, webhook, backup, and renamed browser-state coverage. |
| Frontend quality/build | Pass | Asset validation, TypeScript, Biome lint, and production Vite build passed. The build reports a non-fatal 529 kB main-chunk advisory. |
| Production dependencies | Pass | `npm audit --omit=dev` reported zero vulnerabilities. |
| Documentation freeze checks | Pass | Markdown links/anchors validated across 126 files; current-name and install-command audits were reviewed again after corrections. |
| Installer/workflow syntax | Pass | Installer/release scripts pass `bash -n`; CI, release workflow, production Compose, and development override parse as YAML. |
| Native candidate artifacts | Pass | `1.0.0-rc.local` produced complete amd64/arm64 archives plus Compose, environment example, installer, licence, and checksums. Every checksum verified; all six commands are static ELF binaries for the declared architecture. |
| Legacy controller-name audit | Pass with classified exceptions | Current code/config/docs contain no unexplained old controller identity. Remaining occurrences are changelog/ADR/archive history, the rename audit, and a deliberate pre-1 backup rejection fixture. AdGuard/AGH domain terminology remains where it names the managed upstream product. |
| Repository coordination | Pass | The local HTTPS remote is `https://github.com/benchristian88/atlas-dns.git`; a read-only remote check resolved HEAD. No `v1.0.0*` remote tag existed at the time of the check. |

## Open release gates

These checks require environments or publication state not available in the
local workspace. They must pass before changing the changelog from Unreleased,
creating `v1.0.0`, or claiming final 1.0 publication.

| Gate | Current evidence / required action |
|---|---|
| PostgreSQL integration and migration | An explicit local run could not connect because no PostgreSQL server is listening. GitHub Actions provisions PostgreSQL 17; require a green run and record the migration results. |
| Backup/restore DR | Unit/API/format tests pass, but create/preflight/offline restore into a clean PostgreSQL 17 database and the post-restore checklist require a candidate environment. |
| Docker Compose | Docker is not installed locally. Publish the candidate image, then validate clean pull/start/login/persistence/restart/update/backup/restore on a host without build tools. |
| GHCR | Run the publish-enabled candidate workflow, make the repository-linked package public if GitHub requires it, then prove anonymous pull and inspect the amd64/arm64 manifest and prerelease tag policy. |
| Portainer | Deploy the same candidate `compose.yaml`, enter secrets through the Stack environment, and verify health, named-volume persistence, re-pull, and redeploy. |
| Debian/systemd | On clean Debian 13 amd64 and arm64 (or available representative architecture), verify installer checksum/download, permissions, service hardening, readiness, reboot, update, and recovery without Go/Node/npm/Git. |
| Browser/mobile/PWA | Automated DOM/Axe/assets tests pass. A static preview correctly could not authenticate without a backend and is not counted. Validate packaged Chromium, Firefox, Safari/iOS, Android/PWA, Light/Dark/System, menus, keyboard/touch, responsive lockups, and console output. |
| AdGuard Home | Re-run supported-version node probes, managed write/read-back, drift/deployment, DNS health, DHCP handoff, lifecycle, and outage-DNS evidence against candidate artifacts. |
| Performance | Record candidate timings/limits for Dashboard, Statistics, Query Log, polling/probes, cleanup, backup/restore, and history/detail views with realistic retained data. |
| Final release | After all gates are green, commit the candidate, publish an RC, validate artifacts, then tag/publish `v1.0.0` and verify GitHub Release assets, checksums, public GHCR tags, Compose pull, installer, docs links, and update awareness. |

The [release process](../development/release-process.md),
[compatibility matrix](compatibility-matrix.md), and
[rename inventory](../reference/rename-inventory.md) are the controlling plans
for closing these gates.
