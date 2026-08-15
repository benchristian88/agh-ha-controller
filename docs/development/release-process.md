# Release Process

Release 1.0 establishes the repeatable process for stable 1.x releases. Feature
work stops before release preparation; only blocker fixes, compatibility work,
documentation, and release engineering enter the candidate.

## Candidate gate

1. Select a semantic candidate version such as `1.0.1-rc.1` and freeze scope.
2. Update the changelog, compatibility matrix, support policy, upgrade notes,
   and any schema/API documentation affected by the release.
3. Run formatting, lint, full Go tests and race tests, frontend unit/Axe/assets/
   type/lint/build checks, integration tests, production dependency audit, and
   documentation link/identity checks.
4. Review migrations as append-only and exercise them from the clean 1.0
   baseline (or every supported prior 1.x baseline for later releases).
5. Create and preflight a branded backup, restore it offline into a new empty
   database, and verify the recovery checklist.
6. Exercise authentication, CSRF, authorization, last-admin protection, secrets,
   webhook/lifecycle operations, audit, error/log redaction, and update
   boundaries.
7. Validate desktop/mobile Light/Dark/System behavior, keyboard/focus/dialog
   access, representative supported browsers, and PWA/iOS install metadata.
8. Generate the candidate artifacts and install them on clean Docker and Debian
   targets without Go, Node.js, npm, or a source checkout.
9. Record real AdGuard Home compatibility, database/runtime versions,
   performance observations, known limitations, and all unavailable external
   gates without reporting them as passes.

## Local artifact assembly

Use an unused versioned output directory:

```bash
ATLAS_DNS_VERSION=1.0.1-rc.1 scripts/release-artifacts.sh
```

The script produces self-contained Linux amd64 and arm64 archives, production
Compose and environment inputs, the native installer, BUSL-1.1 terms, and
`checksums.txt`. Each native archive contains all three commands, the exact
frontend assets, systemd unit, README, and license. If `syft` is available, an
SPDX JSON SBOM is added. Existing output is never overwritten.

## GitHub Actions

`.github/workflows/release.yml` accepts `v*` tags and manual candidate builds.
It reruns required tests, assembles and uploads native artifacts, and builds the
same `linux/amd64` and `linux/arm64` OCI image. A publish-enabled run uses the
repository `GITHUB_TOKEN` to create a GitHub Release and publish the linked GHCR
package; no personal access token is required.

Stable `v1.0.1` publishes image tags `1.0.1`, `1.0`, `1`, and `latest`.
Prereleases publish only their exact tag and never move `latest`. The workflow
refuses to replace an existing exact GitHub Release or image tag. Operators
should pin exact versions.

Third-party actions are pinned to commit SHAs. Workflow permissions are
read-only by default and elevated only in the publishing job to `contents: write`
and `packages: write`. Buildx provenance and SBOM attestations are enabled for
published images.

## External release validation

Before final `v1.0.1`, publish and install at least one release candidate. Verify:

- both native archive checksums and runtime contents;
- anonymous pulls and the amd64/arm64 manifest from GHCR;
- production `compose.yaml` pulls instead of builds;
- Docker Compose and Portainer Stack health/persistence/redeploy behavior;
- the Debian/systemd installer downloads and verifies the archive;
- version/build metadata and update awareness;
- clean install, restart, backup, restore, and supported upgrade behavior.

GitHub may require the repository owner to make the first GHCR package public
and confirm its repository association. That one-time setting is an explicit
external gate; anonymous pull must be retested afterwards.

## Final release

Promote the reviewed candidate commit without additional feature changes.
Create the final tag only when every required automated and external gate is
recorded. After publication, verify the GitHub Release assets and checksums,
public GHCR visibility/manifest/tags, production Compose pull, installer
download, source/docs links, and update-awareness response.

Database migrations are forward-only. A binary-only downgrade after migration
is unsupported unless that release's notes explicitly prove otherwise. Always
create and preflight a backup before updating; recovery restores into a new
empty database.

Post-release work is issue triage, regression/security fixes, and documented
patch guidance. Support scope is defined by the current compatibility and
support policies, with no implied SLA.
