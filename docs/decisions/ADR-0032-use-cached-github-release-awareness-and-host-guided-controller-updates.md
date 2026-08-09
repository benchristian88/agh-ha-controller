# ADR-0032: Use cached GitHub release awareness and host-guided controller updates

Status: Accepted

Date: 2026-08-09

## Context

The project is installed from its GitHub repository through Docker Compose or a
Debian/systemd source-build installer. The controller has no safe host package
execution boundary, container socket, rollback manager, or artifact signing
key. Release 0.8's AdGuard Home release cache concerns managed nodes and is not
controller update awareness.

## Decision

AGH HA Controller checks the stable GitHub Releases feed for
`benchristian88/agh-ha-controller`, caches validated bounded metadata in
PostgreSQL, ignores prereleases by default, and retains the last successful
result when the external source is unavailable. Development or unknown builds
are reported explicitly rather than compared as releases.

The UI presents installed and latest versions, release notes/link, last check,
schema/compatibility warnings, installation type, and exact operator guidance.
Docker operators set the reviewed version in `.env`, check out the matching tag,
then run host-side Compose build/pull and up commands; no published image is
claimed while Compose remains source-build based. Native users use the exact
versioned checkout and installer after verifying the release tag/commit and
published artifact checksums.
The web API never executes shell commands, mounts the Docker socket, restarts
the host service, or claims automatic rollback.

Application version, commit, build time, development state, and database schema
version form one backend contract used by health, Updates, About, frontend, and
release artifacts.

## Consequences

- External release metadata is untrusted, length-bounded, validated, and shown
  as text or safe repository links.
- API outages and rate limits degrade to an explicit unknown/stale state.
- One-click self-update remains unsupported.
- Publishing stable GitHub Releases with checksums is part of release readiness.
