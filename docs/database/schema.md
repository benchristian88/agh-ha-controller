# Database Schema Reference

PostgreSQL 17 is the initial system of record. Identifiers exposed outside the
database are UUIDs, timestamps use `timestamptz`/UTC, and migrations are embedded
and applied under a PostgreSQL advisory lock. Applied migration checksums are
immutable.

## Record families

### Identity and audit

- `users` — local administrator identity, password hash, enabled state, version.
- `sessions` — server-side browser sessions; excluded from portable restore.
- `audit_events` — append-only actor/action/safe metadata/request evidence.

User records are retained for audit attribution. Passwords and raw sessions are
never audit metadata.

### Cluster, node, and capability

- `clusters` — desired-state/reconciliation scope and active revision pointer.
- `nodes` — node identity, encrypted credentials, maintenance, observation,
  applied revision, and convergence state.
- `node_capability_profiles` — version/schema-aware supported feature evidence.
- `observed_snapshots` — immutable normalized node configuration observations.

Encrypted credential envelopes and public endpoint identity remain distinct from
canonical configuration documents.

### Configuration and deployment

- `configuration_drafts` — one mutable optimistic desired-state document per
  cluster with optional base revision.
- `configuration_revisions` — immutable published desired state, origin/summary,
  archive time/actor, and monotonically increasing cluster revision number.
- `deployments` — durable requested strategy/status/revision/rollback and archive
  metadata.
- `deployment_nodes` — ordered per-node execution, safe error, observation, and
  verification evidence.
- `drift_events` — desired-versus-observed differences and optional related
  deployment.
- `operational_commands` and `operational_command_node_results` — non-revision
  commands such as guarded DHCP reset/filter refresh, with per-node evidence.

Desired configuration, observed configuration, applied revision, deployment
results, drift, and audit are never collapsed into one record.

Revision hard-delete eligibility rechecks every active/applied/base/deployment/
rollback/drift reference in one transaction. Deployment hard-delete eligibility
requires queued/no-start state, untouched node tasks, and no drift reference.
Archive preserves all foreign keys and immutable content.

### Telemetry and operational status

- `statistics_poll_attempts`, `statistics_snapshots`, `statistics_buckets` —
  bounded node-attributed collection evidence, exact results, and overlap-safe
  hourly/daily aggregates.
- `query_events`, `query_ingestion_checkpoints`, `query_ingestion_attempts` —
  normalized node-attributed events, restart cursor/coverage, and attempts.

Query events use node-scoped source fingerprint/occurrence identity and bounded
keyset/search indexes. Raw source payloads, credentials, and node URLs are not
stored. Operational-history retention is independent from configuration history.

### HA lifecycle and notifications

- `node_lifecycle_settings` and `dns_probe_results` — configurable active-DNS
  checks and immutable results.
- `ha_operational_events` — deduplicated transition evidence.
- `upgrade_operations` — durable operator-guided upgrade lifecycle.
- `upstream_release_cache` — bounded AdGuard Home release awareness.
- `notification_channels` — encrypted HTTPS destination, safe
  `destination_summary`, name, and enabled state.
- `notification_deliveries` — HA event delivery attempts with nullable channel
  reference and durable safe `channel_name` snapshot.

Deleting a notification channel sets the delivery foreign key to null rather
than cascading operational history. HA event and audit records are unaffected.

### Product operations

- `controller_release_cache` — bounded controller release-awareness cache;
  excluded from portable restore.
- `system_settings` — singleton optimistic persistent product settings.

Portable backup metadata is produced outside persistent product tables. Standard
backup retains control-plane rows, including archive status; Full also retains
bounded operational-history data.

## JSON and indexing

JSONB is appropriate for versioned canonical configuration, capability
documents, structured diffs, bounded statistics vectors, and safe audit metadata.
It must not replace core relationships. Canonical documents carry explicit
schema versions and stable hashes; released schema-v1 records are not rewritten
when schema-v2 support is added.

Indexes support cluster/time listing, revision numbering/archive filters,
deployment status/archive filters, drift deduplication, retained-time cleanup,
Query Log keyset/trigram search, and worker claims. High-volume cleanup is
bounded to avoid long uninterruptible transactions.

## Migration ledger

| Version | Current schema purpose |
|---|---|
| `000001` | Users, sessions, audit, clusters/nodes, encrypted credentials, health. |
| `000002` | Immutable observations, capabilities, and configuration inventory/draft. |
| `000003` | Immutable revisions, deployments/results, drift, reconciliation state. |
| `000004` | Canonical configuration schema v2 capability. |
| `000005`–`000008` | Operational commands, UI/control-plane hardening, query/health support. |
| `000009` | Statistics attempts, snapshots, and buckets. |
| `000010` | Query Log events, checkpoints, attempts, and search indexes. |
| `000011` | Operational-health retained-time indexes. |
| `000012` | DNS probes, HA events, lifecycle settings, guided upgrades, webhooks/deliveries. |
| `000013` | Users/product settings, controller release cache, backup productization. |
| `000014` | Revision/deployment archive metadata and non-cascading webhook delivery identity. |

Down migrations exist for development and controlled rollback analysis. They may
be destructive—especially where newer history cannot fit the older model—and
must not be run against retained production data without a documented,
preflighted recovery procedure.
