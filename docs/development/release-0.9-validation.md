# Release 0.9 Validation

## Implemented acceptance surface

- Multiple local administrators, server-side administrator authorization,
  immediate disabled-account enforcement, session revocation, credential reset,
  auditing, and final-administrator protection.
- Passphrase-encrypted Standard/Full PostgreSQL backups, versioned manifests,
  authenticated checksums, bounded preflight, web download/preflight, and
  empty-database offline restore CLI.
- Cached stable controller release awareness, guided host updates, persistent
  check setting, application/build/schema metadata, and development builds.
- Setup Guide, System Settings, Users, Backup & Restore, Updates, About, complete
  navigation, neutral mark, favicon, Apple icon, PWA 192/512 icons, and manifest.
- Append-only migration 000013 and source-build Docker/systemd packaging.

## Automated gates

Run formatting, vet/lint, unit/integration/race tests, frontend type/test/build,
production dependency audit, native builds, migration up/down/up, Compose
configuration/build, shell syntax, manifest/asset validation, and
`git diff --check`.

### Local evidence — 9 August 2026

| Gate | Result |
|---|---|
| Go unit/package suite | Passed: `go test ./...` outside the filesystem/network sandbox required by loopback `httptest` listeners. |
| Go race suite | Passed uncached: `go test -race -count=1 ./...`. |
| Go vet | Passed: `go vet ./...`. |
| Frontend | Passed: Biome lint, TypeScript typecheck, 43 files/224 tests including new user/setup/About accessibility coverage, and production Vite build. |
| Production dependencies | Passed: `npm audit --omit=dev` reports zero vulnerabilities. |
| Native builds | Passed: controller, migrate, and backup binaries plus production frontend. |
| Release artifacts | Passed with validation version: static Linux amd64/arm64 controller/migrate/backup binaries, frontend tar, and verified `SHA256SUMS`. `syft` was unavailable, so no optional SBOM was emitted. |
| Static packaging checks | Passed: installer/release shell syntax, manifest JSON, PNG dimensions, naming scan, and `git diff --check`. |
| PostgreSQL integration/migration/backup restore | Not run locally: `TEST_DATABASE_URL`, PostgreSQL 17 client tools, and a reference database were unavailable. Tests compile; the gate remains open. |
| Docker Compose config/build | Not run locally: Docker/Compose was unavailable. The gate remains open. |
| Packaged browsers/iOS/real AdGuard nodes | Environment-dependent external gates below remain open. |

The production build reports a non-fatal JavaScript chunk-size advisory above
500 kB. It does not affect correctness, but code-splitting remains a pre-1.0
performance review item.

Backup tests must cover Standard/Full table policy, concurrent writes, large
history, wrong passphrase, ciphertext/entry/manifest corruption, malformed and
future archives, path traversal, entry count/size limits, same/older compatible
restore, empty-target enforcement, credentials, users, and post-restore
collectors. Inspect process arguments and logs for database passwords,
passphrases, credential keys, password hashes, and node credentials.

## External release gates

- Upgrade a copy of the validated 0.8 PostgreSQL database through 000013 and
  verify every 0.5–0.8 capability plus users/settings.
- Create Standard and Full backups during collection, restore each to a clean
  installation, install the recovered credential key, restart, authenticate,
  verify disabled users, nodes, revisions, deployments, drift, lifecycle state,
  and expected included/excluded history.
- Validate Docker and Debian/systemd clean install, upgrade, rollback guidance,
  backup utilities, matching PostgreSQL client tools, health, and restart.
- Validate every visible route at desktop/mobile widths in light/dark mode,
  keyboard/focus/contrast, current Chromium/Firefox/Safari, iOS saved-app icon,
  manifest/standalone launch, and absence of console errors.
- Exercise GitHub current/update/outage/rate-limit/malformed metadata and confirm
  no host command, Docker socket, arbitrary URL, or automatic update endpoint.

Release 0.9 and feature freeze remain **implemented; external gates pending**
until this evidence is recorded. Release 0.8 is complete and validated.
