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

Suggested default:

- Disabled until explicitly enabled.
- Raw events: 30 days.
- Hourly aggregate statistics: 1 year.
- Daily aggregate statistics: indefinitely.

The operator must be able to reduce retention.
