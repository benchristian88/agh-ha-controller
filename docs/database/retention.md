# Data Retention

## Control-plane records

Retain indefinitely by default:

- Revisions.
- Deployments.
- Drift events.
- Audit events.

Allow explicit administrative cleanup only in a later release.

## Observed snapshots

Suggested default:

- Full snapshots: 30 days.
- Daily convergence summaries: 1 year.

## Statistics

Release 0.5 enforced default:

- Normalized node snapshots and poll attempts: 32 days.
- Hourly node-attributed buckets: 32 days.
- Daily node-attributed rollups: 400 days.

Cleanup rolls completed hourly days into daily buckets before expiry. Raw node
responses are never stored. Custom operator retention controls remain later
work; changing the node's own statistics retention may reduce which exact
windows it can supply.

## Query events

Release 0.6 enforces a separate central retention window. Collection defaults
to enabled and normalized raw events default to seven days. Operators may set
`QUERY_LOG_COLLECTION_ENABLED=false` without deleting retained data and may set
`QUERY_LOG_RETENTION` from one hour through 90 days. These settings never alter
schema-v2 node-local query-log policy.

Each poll deletes at most 10,000 expired events and 10,000 expired ingestion
attempts; attempt evidence uses a fixed 32-day window. Cleanup failure is logged
and does not block ingestion. Query-derived rollups are intentionally not part
of Release 0.6.
