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

Suggested default:

- Raw node snapshots: 30 days.
- Hourly rollups: 1 year.
- Daily rollups: indefinitely.

## Query events

Suggested default:

- Disabled until explicitly enabled.
- Raw events: 30 days.
- Hourly aggregate statistics: 1 year.
- Daily aggregate statistics: indefinitely.

The operator must be able to reduce retention.
