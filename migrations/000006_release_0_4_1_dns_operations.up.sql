-- Release 0.4.1 Phase 9C-1 generalises the durable command tables for
-- controller-owned fleet DNS operations. Sensitive resolver input is encrypted.
ALTER TABLE operational_commands
    DROP CONSTRAINT operational_commands_command_type_check,
    DROP CONSTRAINT operational_commands_status_check,
    DROP CONSTRAINT operational_commands_check;

ALTER TABLE operational_commands
    ADD COLUMN target_scope text NOT NULL DEFAULT 'node'
        CHECK (target_scope IN ('node', 'all_compatible_enabled_nodes')),
    ADD COLUMN target_node_id uuid REFERENCES nodes(id) ON DELETE RESTRICT,
    ADD COLUMN input_fingerprint text NOT NULL DEFAULT '',
    ADD COLUMN payload_ciphertext bytea,
    ADD COLUMN payload_nonce bytea,
    ADD COLUMN payload_key_version integer,
    ADD COLUMN payload_algorithm text,
    ADD COLUMN excluded_nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN started_at timestamptz,
    ADD CONSTRAINT operational_commands_command_type_check
        CHECK (command_type IN (
            'dhcp_reset_leases', 'dhcp_reset_configuration',
            'test_upstream_dns', 'clear_dns_cache'
        )),
    ADD CONSTRAINT operational_commands_status_check
        CHECK (status IN ('queued', 'running', 'succeeded', 'partial_success', 'failed', 'interrupted')),
    ADD CONSTRAINT operational_commands_payload_check CHECK (
        (payload_ciphertext IS NULL AND payload_nonce IS NULL AND payload_key_version IS NULL AND payload_algorithm IS NULL) OR
        (payload_ciphertext IS NOT NULL AND payload_nonce IS NOT NULL AND payload_key_version IS NOT NULL AND payload_algorithm IS NOT NULL)
    );

UPDATE operational_commands SET started_at = requested_at;

ALTER TABLE operational_commands
    ADD CONSTRAINT operational_commands_lifecycle_check CHECK (
        (status = 'queued' AND started_at IS NULL AND completed_at IS NULL AND audit_reference IS NULL) OR
        (status = 'running' AND started_at IS NOT NULL AND completed_at IS NULL AND audit_reference IS NULL) OR
        (status IN ('succeeded', 'partial_success', 'failed', 'interrupted') AND completed_at IS NOT NULL AND audit_reference IS NOT NULL)
    );

ALTER TABLE operational_command_node_results
    DROP CONSTRAINT operational_command_node_results_status_check,
    DROP CONSTRAINT operational_command_node_results_check;

ALTER TABLE operational_command_node_results
    ADD COLUMN position integer NOT NULL DEFAULT 1 CHECK (position > 0),
    ADD COLUMN result jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN observation_status text NOT NULL DEFAULT 'not_run'
        CHECK (observation_status IN ('not_run', 'succeeded', 'failed')),
    ADD COLUMN observation_snapshot_id uuid REFERENCES observed_snapshots(id) ON DELETE RESTRICT,
    ADD COLUMN observation_error_code text NOT NULL DEFAULT '',
    ALTER COLUMN started_at DROP NOT NULL,
    ADD CONSTRAINT operational_command_node_results_status_check
        CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'skipped')),
    ADD CONSTRAINT operational_command_node_results_lifecycle_check CHECK (
        (status = 'pending' AND started_at IS NULL AND completed_at IS NULL) OR
        (status = 'running' AND started_at IS NOT NULL AND completed_at IS NULL) OR
        (status IN ('succeeded', 'failed', 'skipped') AND completed_at IS NOT NULL)
    );

CREATE INDEX operational_commands_queue_idx
    ON operational_commands (requested_at, id) WHERE status = 'queued';
