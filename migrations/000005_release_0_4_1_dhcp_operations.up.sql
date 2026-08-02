-- Release 0.4.1 persists destructive DHCP operational commands separately
-- from desired configuration revisions and deployments.
CREATE TABLE operational_commands (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    command_type text NOT NULL
        CHECK (command_type IN ('dhcp_reset_leases', 'dhcp_reset_configuration')),
    status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
    requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    request_id text NOT NULL,
    idempotency_key uuid NOT NULL,
    observation_status text NOT NULL DEFAULT 'not_run'
        CHECK (observation_status IN ('not_run', 'succeeded', 'failed')),
    observation_snapshot_id uuid REFERENCES observed_snapshots(id) ON DELETE RESTRICT,
    observation_error_code text NOT NULL DEFAULT '',
    audit_reference uuid REFERENCES audit_events(id) ON DELETE RESTRICT,
    requested_at timestamptz NOT NULL,
    completed_at timestamptz,
    CHECK (
        (status = 'running' AND completed_at IS NULL AND audit_reference IS NULL) OR
        (status IN ('succeeded', 'failed') AND completed_at IS NOT NULL AND audit_reference IS NOT NULL)
    ),
    UNIQUE (requested_by, idempotency_key)
);

CREATE INDEX operational_commands_cluster_requested_idx
    ON operational_commands (cluster_id, requested_at DESC);

CREATE TABLE operational_command_node_results (
    id uuid PRIMARY KEY,
    command_id uuid NOT NULL REFERENCES operational_commands(id) ON DELETE RESTRICT,
    node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
    error_code text NOT NULL DEFAULT '',
    started_at timestamptz NOT NULL,
    completed_at timestamptz,
    CHECK (
        (status = 'running' AND completed_at IS NULL) OR
        (status IN ('succeeded', 'failed') AND completed_at IS NOT NULL)
    ),
    UNIQUE (command_id, node_id)
);

CREATE INDEX operational_command_node_results_node_idx
    ON operational_command_node_results (node_id, started_at DESC);
