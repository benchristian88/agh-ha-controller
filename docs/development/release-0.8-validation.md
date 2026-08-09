# Release 0.8 Validation

## Implemented acceptance surface

- Distinct management API and active UDP/TCP DNS health.
- N-node HA summary, transition history, maintenance coordination, DHCP gates,
  return-to-service verification, certificate warnings, upstream version
  awareness, guided upgrades, and encrypted webhook notifications.
- Authenticated, CSRF-protected mutation API and responsive HA Operations/node
  lifecycle UI with automated accessibility coverage.
- Append-only migration 000012 and bounded operational evidence retention.

## Completed release gates

Run `make test`, the uncached Go race suite, frontend format/type/test/build,
PostgreSQL integration with `TEST_DATABASE_URL`, migration up/down/up on a copy
of a 0.7 database, and `git diff --check`. Exercise two real nodes for UDP/TCP
failure and recovery, maintenance with DHCP, target-version mismatch, expired
certificate inventory, notification retry/suppression, controller restart, and
controller shutdown while DNS continues.

Then validate both production packages: upgrade and clean install with Docker
Compose and native/systemd, browser desktop/mobile light/dark workflows, restart
persistence, logs/redaction, and rollback using each platform's documented
operator procedure.

The operator confirmed completion of the real-node, PostgreSQL migration,
packaged browser, Docker Compose, and native/systemd gates on 9 August 2026.
Release 0.8 is complete and validated. This record preserves the gate that was
run rather than replacing it with a less specific completion claim.

## Security review

Probe settings cannot select an unspecified or loopback target implicitly.
Webhook destinations and node credentials are encrypted and write-only.
Lifecycle errors are stable and bounded. Audit and HA-event metadata contain
identifiers, decisions, and check names—not credentials, URLs, certificate/key
material, raw upstream responses, or DNS activity.
