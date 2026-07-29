ALTER TABLE clusters
    ADD COLUMN reconciliation_policy text NOT NULL DEFAULT 'manual'
        CHECK (reconciliation_policy IN ('enforce', 'alert', 'manual')),
    ADD COLUMN active_revision_id uuid;

ALTER TABLE nodes
    ADD COLUMN maintenance_mode boolean NOT NULL DEFAULT false,
    ADD COLUMN applied_revision_id uuid,
    ADD COLUMN applied_hash text NOT NULL DEFAULT '',
    ADD COLUMN convergence_status text NOT NULL DEFAULT 'pending'
        CHECK (convergence_status IN ('pending', 'converged', 'drifted', 'applying', 'verifying', 'apply_failed', 'observation_failed', 'unsupported', 'maintenance')),
    ADD COLUMN last_reconciled_at timestamptz;

CREATE TABLE configuration_revisions (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    revision_number integer NOT NULL CHECK (revision_number > 0),
    schema_version integer NOT NULL CHECK (schema_version = 1),
    document_json jsonb NOT NULL,
    canonical_hash text NOT NULL,
    summary text NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL,
    CHECK (jsonb_typeof(document_json) = 'object'),
    CHECK (char_length(summary) BETWEEN 1 AND 500),
    UNIQUE (cluster_id, revision_number)
);

ALTER TABLE clusters
    ADD CONSTRAINT clusters_active_revision_fk
    FOREIGN KEY (active_revision_id) REFERENCES configuration_revisions(id) ON DELETE RESTRICT;

ALTER TABLE nodes
    ADD CONSTRAINT nodes_applied_revision_fk
    FOREIGN KEY (applied_revision_id) REFERENCES configuration_revisions(id) ON DELETE RESTRICT;

ALTER TABLE configuration_drafts
    ADD COLUMN base_revision_id uuid REFERENCES configuration_revisions(id) ON DELETE RESTRICT;

-- Release 0.2 drafts contain the observed document imported from one node.
-- Preserve its shared values and promote that node's listener identity into the
-- desired document's nodeOverrides map.  Observed-only fields never become
-- authoritative desired state.
UPDATE configuration_drafts AS d
SET document_json = jsonb_build_object(
        'schemaVersion', 1,
        'shared', d.document_json -> 'shared',
        'nodeOverrides', jsonb_build_object(s.node_id::text, d.document_json -> 'nodeSpecific'),
        'unsupported', COALESCE(d.document_json -> 'unsupported', '[]'::jsonb)
    ),
    canonical_hash = ''
FROM observed_snapshots AS s
WHERE s.id = d.source_snapshot_id
  AND d.document_json ? 'nodeSpecific';

CREATE TABLE deployments (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    revision_id uuid NOT NULL REFERENCES configuration_revisions(id) ON DELETE RESTRICT,
    status text NOT NULL CHECK (status IN ('queued', 'validating', 'running', 'partially_succeeded', 'succeeded', 'failed', 'cancelling', 'cancelled', 'interrupted')),
    strategy text NOT NULL DEFAULT 'sequential' CHECK (strategy = 'sequential'),
    failure_policy text NOT NULL DEFAULT 'stop' CHECK (failure_policy = 'stop'),
    origin text NOT NULL CHECK (origin IN ('manual', 'rollback', 'reconciliation')),
    rollback_of_revision_id uuid REFERENCES configuration_revisions(id) ON DELETE RESTRICT,
    requested_by uuid REFERENCES users(id) ON DELETE RESTRICT,
    request_id text NOT NULL,
    cancel_requested boolean NOT NULL DEFAULT false,
    error_code text NOT NULL DEFAULT '',
    requested_at timestamptz NOT NULL,
    started_at timestamptz,
    completed_at timestamptz
);

CREATE INDEX deployments_cluster_requested_idx ON deployments (cluster_id, requested_at DESC);
CREATE INDEX deployments_runnable_idx ON deployments (status, requested_at) WHERE status = 'queued';
CREATE UNIQUE INDEX deployments_one_active_per_cluster ON deployments (cluster_id)
    WHERE status IN ('queued', 'validating', 'running', 'cancelling');

CREATE TABLE deployment_nodes (
    id uuid PRIMARY KEY,
    deployment_id uuid NOT NULL REFERENCES deployments(id) ON DELETE RESTRICT,
    node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    position integer NOT NULL CHECK (position > 0),
    effective_hash text NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'validating', 'applying', 'verifying', 'succeeded', 'failed', 'skipped', 'interrupted')),
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    started_at timestamptz,
    completed_at timestamptz,
    error_code text NOT NULL DEFAULT '',
    error_message text NOT NULL DEFAULT '',
    verification_snapshot_id uuid REFERENCES observed_snapshots(id) ON DELETE RESTRICT,
    UNIQUE (deployment_id, node_id),
    UNIQUE (deployment_id, position)
);

CREATE INDEX deployment_nodes_deployment_idx ON deployment_nodes (deployment_id, position);
CREATE INDEX deployment_nodes_node_idx ON deployment_nodes (node_id, completed_at DESC);

CREATE TABLE drift_events (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    desired_revision_id uuid NOT NULL REFERENCES configuration_revisions(id) ON DELETE RESTRICT,
    desired_hash text NOT NULL,
    observed_snapshot_id uuid NOT NULL REFERENCES observed_snapshots(id) ON DELETE RESTRICT,
    observed_hash text NOT NULL,
    fingerprint text NOT NULL,
    status text NOT NULL CHECK (status IN ('open', 'resolved')),
    policy text NOT NULL CHECK (policy IN ('enforce', 'alert', 'manual')),
    reconciliation_status text NOT NULL CHECK (reconciliation_status IN ('pending', 'alerted', 'enforcing', 'failed', 'maintenance', 'resolved')),
    diff_json jsonb NOT NULL,
    detected_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    resolved_at timestamptz,
    resolution text NOT NULL DEFAULT '',
    related_deployment_id uuid REFERENCES deployments(id) ON DELETE RESTRICT,
    CHECK (jsonb_typeof(diff_json) = 'array'),
    CHECK ((status = 'open' AND resolved_at IS NULL) OR (status = 'resolved' AND resolved_at IS NOT NULL))
);

CREATE UNIQUE INDEX drift_events_open_fingerprint_unique ON drift_events (node_id, fingerprint) WHERE status = 'open';
CREATE INDEX drift_events_cluster_detected_idx ON drift_events (cluster_id, detected_at DESC);
CREATE INDEX drift_events_node_open_idx ON drift_events (node_id, detected_at DESC) WHERE status = 'open';
