# Query Ingestion Design

## Phase 1: API polling

The controller periodically reads query-log entries from each node.

Requirements:

- Per-node cursor.
- Overlap window to avoid missing records.
- Deterministic deduplication key.
- Node attribution.
- Ingestion lag.
- Persisted checkpoint.
- Retention policy.
- Restart-safe behaviour.

## Phase 2: local forwarder

The forwarder reads the AdGuard Home query-log file and sends batches to the controller.

### Forwarder responsibilities

- Detect log rotation.
- Persist inode or file identity and byte offset.
- Parse records.
- Create stable event IDs.
- Batch and compress.
- Authenticate to the controller.
- Retry with exponential backoff.
- Spool to local disk.
- Report health and lag.
- Upgrade without losing the checkpoint.

### Delivery semantics

Use at-least-once delivery.

The controller must deduplicate based on a stable source identity and event identity.

## Event model

Suggested fields:

- Event ID.
- Node ID.
- Source timestamp.
- Received timestamp.
- Client address.
- Client identity.
- Domain.
- Query type.
- Response status.
- Upstream.
- Elapsed time.
- Filtering result.
- Rule or service attribution.
- Original raw metadata where safe.

## Privacy

Query logs may reveal sensitive browsing behaviour.

Requirements:

- Configurable retention.
- Role-based access in later releases.
- Redacted diagnostic exports.
- Clear operator warning.
- Optional disabled state.
- No external telemetry by default.
