# Release 1.0 Technical Rename Inventory

Release 0.9.2 keeps **AGH HA Controller** and all `agh-ha-controller` technical
identifiers. This inventory defines the deliberate future rename pass; it does
not choose final replacement identifiers or authorize partial changes.

## User-visible product naming

- UI startup/login/setup/header/navigation, page titles, About, error text, and
  accessibility labels under `web/src/`.
- Root README, repository policies, current docs, ADR prose, changelog/history,
  diagrams, screenshots, and generated release notes.
- HTML title/meta description/theme metadata, `web/index.html`, SVG lockups,
  favicons, Apple touch icon, raster PWA icons, and alt text.
- `web/public/manifest.webmanifest`: application `name`, `short_name`,
  description, icon purpose, and installed-app identity.
- Current Atlas source artwork identifiers/masters: review separately from
  product/technical strings; do not assume every `atlas` source token changes.

## Repository and source identifiers

- Repository/directory name `agh-ha-controller` and all GitHub URLs,
  documentation links, clone commands, badges, issue/security-advisory links,
  release metadata source, and update links.
- Go module path and every import in `go.mod`, Go source/tests, generated tooling,
  and downstream consumers.
- Go package/build metadata, linker variables, user-agent strings, audit actor or
  origin labels, backup format application identifiers, and migration comments
  where compatibility permits.
- npm package name/version metadata and lockfile root package record.

## Executables, services, and packaging

- `agh-ha-controller` and `agh-ha-backup` binary names, Make targets/paths,
  release archive names, checksum/SBOM component names, and CLI help/examples.
- `agh-ha-controller.service`, systemd unit description, service user/group
  `aghha`, installed unit name, journal commands, and restart/upgrade behavior.
- Installation paths `/etc/agh-ha-controller`, `/var/lib/agh-ha-controller`,
  `/usr/local/share/agh-ha-controller`, environment filename, and migration plan
  or compatibility aliases for existing installations.
- Docker Compose project/service/image `agh-ha-controller`, build labels,
  container user/path assumptions, named volumes, network/DNS aliases, health
  checks, and published image/repository coordinates.
- Dockerfile paths/user-agent/build args and `.dockerignore`/release scripts.
- Debian/LXC examples, reverse-proxy examples, monitoring job names, and backup
  automation commands.

## Configuration and external contracts

- Environment variable names only where product-prefixed names exist; preserve
  generic contract names such as `DATABASE_URL` unless an explicit migration
  requires otherwise. Inventory `.env.example`, Compose, systemd environment,
  tests, docs, and deployment automation.
- Database name/user defaults (`aghha`), database URLs, role ownership, schema
  comments, seed/fixture names, and backup target examples.
- API paths, JSON identifiers, error codes, cookie names, CSRF/session names,
  metric names/labels, request headers, and webhook payload `source`/event fields.
  Compatibility must be decided before changing any externally consumed value.
- Backup extension `.aghhabackup`, outer/inner manifest application identifiers,
  encryption labels, format-version compatibility, CLI confirmations, and
  recovered-key filenames.
- Local storage keys for theme/browser state, cache keys, PWA scope/start URL,
  and existing bookmarks/legacy route redirects.

## Operational and integration references

- Structured log service/component names, Prometheus scrape configuration,
  dashboards/alerts, audit action metadata, support bundles, and runbooks.
- PostgreSQL database/role, Docker volumes, systemd enablement, firewall/reverse
  proxy rules, TLS certificates, DNS names, and external secret-manager entries.
- GitHub release API owner/repository, release URLs, updater cache records, and
  current-version comparison behavior.
- CI job/artifact/cache names, scripts, test snapshots/fixtures, browser
  screenshots, deployment examples, and any personal marketplace/plugin data.

## Compatibility work required

1. Select canonical display, slug, module, binary, service, image, database,
   config-path, backup, and external-contract names as one decision.
2. Generate an occurrence report with case-sensitive searches for
   `AGH HA Controller`, `agh-ha-controller`, `aghha`, `agh_ha`, `agh-ha`, GitHub
   URLs, backup extensions, and known Atlas artwork/source tokens.
3. Classify each occurrence as display-only, internal, externally consumed, or
   persisted. Define aliases/migrations before editing persisted/external names.
4. Update code, packaging, docs, assets, tests, release infrastructure, and
   examples in one controlled branch; do not strand mixed frontend/API builds.
5. Test clean Docker/native installs, upgrades from the final 0.9.2 build,
   service/path migration, database access, backup preflight/restore, browser/PWA
   upgrade, old bookmarks, metrics, webhooks, and rollback.
6. Re-run secret/copy/link/asset scans and publish explicit operator migration
   instructions plus the final compatibility window.

The 1.0 pass should use repository-wide tooling rather than this prose alone;
this inventory names semantic categories that a string search can miss.
