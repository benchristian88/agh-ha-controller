# Database Design

## Database

PostgreSQL is the initial primary database.

## Design principles

- UTC timestamps.
- UUID primary identifiers for exposed resources.
- Append-only immutable revisions and audit records.
- Explicit state transitions.
- Encrypted secret payloads.
- Normalised control-plane data.
- Partitionable high-volume event tables.
- Foreign-key integrity.
- Migration-based schema changes.

## Core tables

### users

- id
- email
- display_name
- password_hash
- role
- enabled
- created_at
- updated_at
- last_login_at

### sessions

- id
- user_id
- token_hash
- created_at
- expires_at
- last_seen_at
- revoked_at
- ip_metadata
- user_agent

### clusters

- id
- name
- description
- reconciliation_policy
- active_revision_id
- created_at
- updated_at

### nodes

- id
- cluster_id
- name
- base_url
- encrypted_credentials
- certificate_policy
- enabled
- maintenance_mode
- last_seen_at
- health_status
- version
- capabilities_json
- created_at
- updated_at

### configuration_drafts

- id
- cluster_id
- base_revision_id
- document_json
- version
- updated_by
- updated_at

### configuration_revisions

- id
- cluster_id
- revision_number
- schema_version
- document_json
- canonical_hash
- summary
- created_by
- created_at

### node_overrides

Node overrides may be embedded in the revision document initially. If independent querying or ownership becomes important, extract them into a separate revisioned table.

### observed_snapshots

- id
- node_id
- observed_at
- schema_version
- document_json
- canonical_hash
- node_version
- collection_status
- error_code

### deployments

- id
- cluster_id
- revision_id
- status
- strategy
- requested_by
- requested_at
- started_at
- completed_at

### deployment_nodes

- id
- deployment_id
- node_id
- effective_hash
- status
- attempt_count
- started_at
- completed_at
- error_code
- error_message
- verification_snapshot_id

### drift_events

- id
- node_id
- desired_revision_id
- desired_hash
- observed_snapshot_id
- observed_hash
- status
- policy
- diff_json
- detected_at
- resolved_at
- resolution
- related_deployment_id

### audit_events

- id
- actor_type
- actor_user_id
- action
- resource_type
- resource_id
- request_id
- metadata_json
- created_at

### statistics_snapshots

- id
- node_id
- period_start
- period_end
- source_payload_json
- normalised_metrics_json
- collected_at

### query_events

- event_id
- node_id
- source_timestamp
- received_at
- client_address
- client_name
- domain
- query_type
- status
- upstream
- elapsed_ms
- result
- rule
- source_identity

### ingestion_checkpoints

- id
- node_id
- mode
- checkpoint_json
- last_event_at
- last_success_at
- lag_seconds
- updated_at

## Indexing

Initial indexes:

- users: unique lower(email).
- sessions: token_hash, expires_at.
- nodes: cluster_id, health_status.
- revisions: unique(cluster_id, revision_number).
- observations: node_id plus observed_at descending.
- deployments: cluster_id plus requested_at descending.
- deployment_nodes: deployment_id, node_id.
- drift: node_id plus detected_at descending, unresolved status.
- audit: created_at descending, resource lookup.
- query_events: node_id and source_timestamp.
- query_events: domain and source_timestamp.
- query_events: client address and source timestamp.

## High-volume strategy

For query events:

1. Start with a PostgreSQL partitioned table by time.
2. Keep recent raw records.
3. Build hourly and daily rollups.
4. Make retention configurable.
5. Measure before introducing ClickHouse.

## Secrets

Store node credentials as encrypted envelopes.

The database stores:

- Ciphertext.
- Nonce.
- Key version.
- Encryption metadata.

The encryption key is supplied through controller runtime configuration and is not stored in the database.

## Optimistic concurrency

Drafts and mutable settings should have a version integer or updated-at precondition.

An update with a stale version returns a conflict and does not overwrite another operator's work.
