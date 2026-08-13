# Release 1.0 Technical Rename Inventory

This is the final identifier-family record for the controlled **AGH HA
Controller → Atlas DNS Controller** rename. Historical release/ADR/archive text
and genuine AdGuard Home domain terminology remain intentionally unchanged.

| Legacy token / family | Representative locations | Purpose / class | Final treatment | Compatibility decision | Validation |
|---|---|---|---|---|---|
| `AGH HA Controller` and older display variants | Current UI, README, current docs, HTML/PWA metadata | A: user-visible controller identity | `Atlas DNS Controller`; short form `Atlas DNS` | No display alias | UI tests, asset check, current-doc audit |
| `agh-ha-controller` repository/module | `go.mod`, Go imports, GitHub URLs, update feed | B/C: source and public distribution identity | `github.com/benchristian88/atlas-dns` and repository `atlas-dns` | GitHub repository rename is an owner action; old redirects are not used in current inputs | Go build/test/vet and URL audit |
| Old controller/backup commands | Makefile, command directories, systemd, archives, docs | B/C: shipped command names | `atlas-dns`, `atlas-dns-backup`, `atlas-dns-migrate` | Fresh install; no pre-1 command shim | build, archive inspection, shell syntax |
| Old service/user/path family | systemd, installer, Dockerfile, docs | B/C: host runtime identity | `atlas-dns.service`, user/group `atlas-dns`, `/etc/atlas-dns`, `/var/lib/atlas-dns`, `/usr/local/share/atlas-dns` | Pre-1 in-place migration unsupported | unit/installer review and clean-host gate |
| Old Compose/image family | Compose, workflow, Dockerfile, docs | B/C: container distribution | project/service `atlas-dns`; `ghcr.io/benchristian88/atlas-dns` | Production pulls exact image; development build is an override | Compose configuration, multi-platform candidate gate |
| `aghha` database defaults | Compose, examples, installer, tests | B: default deployment identity | database/role `atlas_dns` | Database tables/columns and released migrations are not cosmetically renamed | migration/integration and current-example audit |
| `CONTROLLER_*` product build/runtime variables | Makefile, Docker, Compose, docs | C: operator/build configuration | `ATLAS_DNS_VERSION`, `ATLAS_DNS_COMMIT`, `ATLAS_DNS_BUILT_AT`, `ATLAS_DNS_BIND_ADDRESS`, `ATLAS_DNS_PORT` | Generic variables such as `DATABASE_URL`, `PUBLIC_BASE_URL`, and `SESSION_SECRET` remain | configuration search and builds |
| `aghha_session`, `aghha_csrf` | API/auth/frontend tests | C: browser security identifiers | `atlas_dns_session`, `atlas_dns_csrf` | Pre-1 browser sessions intentionally expire; sessions are never portable | auth/CSRF tests |
| `aghha-*` browser/CSS/storage namespaces | CSS variables, theme and operation storage, TSX/tests | B/C: controller-owned frontend namespace | coherent `atlas-*` namespace | Browser-local pre-1 state may reset; no persistent server data | selector search, frontend test/build, browser gate |
| `.aghhabackup`, `AGHHABACKUP`, old application identity | Backup envelope/code/tests/history | C/D: persisted archive format | `.atlasdnsbackup`, `ATLASDNSBACKUP`, MIME `application/vnd.atlas-dns.backup`, app `atlas-dns` | Pre-1 archives fail closed and are documented unsupported; rejection fixture remains | backup/API/CLI tests and clean restore gate |
| Product User-Agent/source attribution | updater, filters, notifications | B/C: outbound controller identity | `Atlas-DNS-Controller` or `Atlas DNS Controller` as appropriate | No compatibility alias | adapter/service tests and search |
| Product metrics/logging | telemetry, structured logs, docs | C: operational identifiers | Existing generic metric names and structured components are retained where they do not expose the old brand | Avoid needless dashboard/API churn; no legacy product prefix was found | metric/auth tests and semantic audit |
| `/api/v1`, JSON fields, error codes, tables/columns | API/database source and docs | C: first stable API/data contract | Retained unless controller branding leaked | Stability takes priority over cosmetic renaming; migrations stay append-only | contract/integration tests |
| Historical old names | `CHANGELOG.md`, accepted ADRs, `docs/archive/pre-1.0`, pre-1 rejection tests | D: accurate history/compatibility evidence | Retain | Required to explain prior releases and fail-closed compatibility | final classified search |
| `AdGuard`, `AdGuard Home`, contextual `AGH` | adapters, capabilities, configuration, UI, docs/tests | D: managed upstream product/domain | Retain | These describe the DNS server Atlas manages and are not Atlas branding | case-sensitive semantic review |

## Final namespace decisions

- Display: `Atlas DNS Controller`; short display: `Atlas DNS`.
- Repository/module/image slug: `atlas-dns`.
- Frontend/CSS prefix: `atlas-`; cookie/database-safe prefix: `atlas_dns`.
- Binary/service/user/group: `atlas-dns`.
- Backup: `atlas-dns-backup`, `.atlasdnsbackup`, `ATLASDNSBACKUP`, application
  identity `atlas-dns`.
- Stable API paths and schema internals are not renamed for appearance.

## External coordination

The repository owner must rename the GitHub repository to `atlas-dns`, then
update this checkout's existing HTTPS remote to
`https://github.com/benchristian88/atlas-dns.git`. The first GHCR publication may
also require making the linked package public. After both actions, rerun link,
release-feed, anonymous image-pull, and multi-platform manifest checks. Current
release inputs do not intentionally depend on GitHub's old-name redirects.
