# Schema Notes

Migration `000011_release_0_7_operational_health` adds only retained-time
indexes for `statistics_snapshots.collected_at` and
`query_events(source_timestamp,id)`. Operational health remains derived from
the released node/observation/Statistics/Query Log/control-plane records and
PostgreSQL metadata; no parallel health table is introduced. Statistics
retention deletes are bounded in repository queries.

Migration `000012_release_0_8_ha_operations` adds per-node lifecycle/probe
settings, immutable DNS probe results, HA transition events, guided upgrade
operations, an upstream release cache, encrypted notification channels, and
bounded delivery attempts. Desired configuration, observed configuration,
deployment results, and lifecycle evidence remain separate. One partial unique
index prevents concurrent active upgrades for a node; channel/event uniqueness
prevents duplicate notification delivery.

## Release 0.6 combined Query Log

Migration `000010_release_0_6_query_log` installs the trusted `pg_trgm`
extension and adds three record families separate from desired state:

- `query_events`: normalized immutable, cluster/node-attributed source events;
- `query_ingestion_checkpoints`: one restart-safe cursor/coverage record per
  node; and
- `query_ingestion_attempts`: bounded collection evidence and safe failures.

`query_events` uses UUID identity, UTC `timestamptz`, bounded scalar fields, and
bounded JSONB arrays only for rules and answers. Node-scoped uniqueness combines
the SHA-256 source fingerprint and source occurrence. Composite descending
cluster/time and cluster/node/time indexes support keyset pagination; status and
type indexes support filters; lower-case trigram GIN indexes support parameterized
domain/client substring search. Administrative credentials, node URLs, raw
payloads, and unrelated configuration are not stored.

## Release 0.5 statistics

Migration `000009_release_0_5_statistics` keeps telemetry concerns separate:

- `statistics_poll_attempts` records bounded per-node collection evidence,
  the count of ranges eligible under the node's retention, and stable safe
  per-range errors for failures or configured retention exclusions;
- `statistics_snapshots` stores immutable normalized exact-range node results;
  and
- `statistics_buckets` stores overlap-safe hourly/daily additive counters with
  node attribution.

Foreign keys preserve cluster/node history. Snapshot rankings and series are
bounded JSON arrays rather than unreviewed raw payloads. Bucket identity is
`(node_id, resolution, bucket_start)`, allowing newer overlapping reads to
replace the same source bucket without adding it twice. Desired configuration,
observed configuration, deployments, statistics, and query events remain
distinct record families.

## Migration naming

```text
000001_create_users.up.sql
000001_create_users.down.sql
000002_create_clusters_nodes.up.sql
000002_create_clusters_nodes.down.sql
```

Down migrations are useful during early development. After stable production releases, destructive rollback should be treated cautiously.

The first implemented pair is:

```text
000001_release_0_1.up.sql
000001_release_0_1.down.sql
```

Release 0.2 adds `000002_release_0_2.up.sql` and `.down.sql`. Upgrade is append-only from 0.1/0.1.1 and preserves all foundation records.

Release 0.3 adds `000003_release_0_3.up.sql` and `.down.sql`. It promotes legacy imported drafts to the authoritative `nodeOverrides` shape, then adds immutable `configuration_revisions`, durable `deployments` and `deployment_nodes`, deduplicated `drift_events`, cluster reconciliation/active-revision state, node maintenance/applied/convergence state, and draft base revisions. The migration is append-only and does not alter released 0.1 or 0.2 files.

Release 0.4 adds `000004_release_0_4.up.sql` and `.down.sql`. It permits canonical schema versions 1 and 2 in the four existing versioned configuration tables. No released record is rewritten: schema-v1 snapshots/revisions keep their JSON and hash, while new v2 observations, drafts, and revisions use the same repositories and relationships. Down migration is intentionally blocked by PostgreSQL constraints until all v2 records have been removed in a disposable development environment.

Release 0.4.1 Phase 8B adds
`000005_release_0_4_1_dhcp_operations.up.sql` and `.down.sql`. It stores
`operational_commands` separately from desired revisions/deployments and stores
explicit per-node outcomes in `operational_command_node_results`. UUID
idempotency is unique per requesting user. Terminal records reference their
append-only audit event and optional post-command observation without storing
raw upstream responses or credentials.

Migration files are embedded in the `migrations` Go package. The runner takes a PostgreSQL advisory lock, executes each version in a transaction, and rejects checksum changes to previously applied versions. The controller applies pending migrations by default; `cmd/migrate` provides explicit up and single-step development down modes.

## JSON usage

Use JSONB for:

- Version-variable AdGuard Home capability documents.
- Immutable canonical configuration documents.
- Structured diffs.
- Audit metadata.
- Raw source statistics.

Do not use JSONB to avoid modelling core relationships.

## Timestamps

Use `timestamptz`.

## Identifiers

Use UUIDs generated by the application or PostgreSQL.

Avoid exposing sequential IDs.

Release 0.1 UUIDs are generated with `crypto/rand` in the application before transactions begin.

## Release 0.9 productisation

Migration `000013_release_0_9_productisation` adds singleton
`controller_release_cache` and `system_settings` tables. The release cache holds
bounded non-secret stable release metadata and failure state. System settings
use optimistic `record_version` and audit the acting user. Existing users table
semantics support multiple administrator identities; no role constraint is
widened and no historical identity is deleted.

Portable backup retains the migration ledger and schema for every table.
Standard Backup excludes data—not schema—for sessions, release caches,
Statistics, Query Log ingestion/events, DNS probes, HA events, and notification
deliveries. Full Backup includes retained operational history. Users, password
hashes, enabled state, nodes/encrypted credentials, configuration history,
deployments, drift, audit, lifecycle/upgrade continuity, notification channels,
and system settings are recovery data.
