# HA Operations and Lifecycle

HA Operations coordinates maintenance, active DNS evidence, certificates,
versions, guided upgrades, events, and notifications without placing the
controller in the DNS path or owning node package execution.

## Active DNS and capacity

Node API health and active DNS health are separate. A worker sends a bounded DNS
query to each enabled non-maintenance node every 30 seconds using the node URL
host and observed DNS port by default. Operators can configure host, port, query
name/type, expected RCODE, and UDP/TCP. Each network operation has a two-second
bound.

Latest results and 30 days of probe evidence are durable; only transitions
create HA events, retained for one year. A result is healthy only when every
enabled protocol succeeds. Cluster state supports N nodes: healthy requires at
least two fresh serving nodes and no other degradation; degraded retains serving
redundancy with management/convergence/maintenance concerns; at-risk has fewer
than two verified serving nodes.

## Maintenance and return

Preflight blocks active deployments and an observed active DHCP owner and keeps
open drift visible. Removing the last verified DNS node requires the exact
break-glass confirmation. Maintenance excludes the node from normal polling,
deployment, and reconciliation and suppresses its expected DNS-failure alerts.

Return is fail-closed. It freshly checks API, capability/configuration
observation, DNS, active-revision convergence, drift, DHCP, TLS, and configured
collectors. Any required failure leaves maintenance enabled.

## Certificate and version awareness

Certificate state uses redacted observation metadata. Warning begins at 30 days,
critical at seven days, and expired is distinct. Private material and filesystem
paths never enter this model.

The AdGuard Home release checker reads the official GitHub latest-release API at
most every six hours and retains safe stale-cache state after failure.
Compatibility remains derived from explicit adapter profiles, not an upstream
tag alone.

## Guided upgrades

Native/systemd and Docker nodes can have a durable guided operation. The
operator uses the platform-native install/container mechanism; the controller
records target/progress and performs fresh installed-version plus complete
return-to-service validation. Unsupported installation types are explicit.
Failure records safe evidence and leaves maintenance enabled. There is no remote
shell, automatic upgrade, Docker socket, or controller-owned rollback.

## Webhook channels

Webhook delivery uses the existing HA event stream. Destinations are HTTPS,
AES-256-GCM encrypted, and write-only. Payloads contain bounded event identity,
type, severity, summary, time, and optional node identity. Normal deliveries are
durable and retry at most five times with safe error codes.

Administration supports add, edit, enable/disable, delete, and test:

- List/read returns name, safe scheme/host summary, explicit enabled state, the
  currently fixed HA-transition subscription, timestamps, and safe delivery
  state where available—never the destination.
- Edit preserves the encrypted destination unless replacement is explicitly
  requested with a valid new HTTPS value.
- Disabled channels receive no new events and retain configuration for re-enable.
- Test sends one bounded synthetic event directly, follows no redirect, does not
  enqueue an HA alert, and exposes no destination or response body.
- Delete requires exact-name confirmation. HA events remain unchanged and
  delivery rows retain a safe channel-name snapshot with a nullable channel
  reference.

All mutations require an administrator session, CSRF, validation, and audit.
Names must not contain secrets. Destination userinfo/fragments are rejected;
path and query are hidden from summaries and diagnostics.

## Node Detail presentation

Node Detail is the operational decision surface for one node. It uses common
page/header/group/field/status/action primitives and groups overview, DNS,
maintenance/DHCP, TLS, software, collectors, and history. It links to the
canonical Configuration Control, Drift, Deployments, DHCP, Statistics, Query
Log, Operational Status, and Audit views instead of duplicating those datasets.

## Retention and evidence

Probe results, transition events, upgrade operations, webhook channels, and
delivery attempts are separate from desired configuration and deployment
history. Bounded cleanup never removes audit or configuration history as a side
effect. Notification channel deletion preserves operational event/delivery
evidence as described above.
