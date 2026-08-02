DROP INDEX operational_commands_queue_idx;

DELETE FROM operational_command_node_results
WHERE command_id IN (
    SELECT id FROM operational_commands
    WHERE command_type IN ('test_upstream_dns', 'clear_dns_cache')
);
DELETE FROM operational_commands
WHERE command_type IN ('test_upstream_dns', 'clear_dns_cache');

ALTER TABLE operational_command_node_results
    DROP CONSTRAINT operational_command_node_results_lifecycle_check,
    DROP CONSTRAINT operational_command_node_results_status_check,
    DROP CONSTRAINT operational_command_node_results_observation_snapshot_id_fkey,
    DROP CONSTRAINT operational_command_node_results_observation_status_check,
    DROP COLUMN observation_error_code,
    DROP COLUMN observation_snapshot_id,
    DROP COLUMN observation_status,
    DROP COLUMN result,
    DROP COLUMN position,
    ALTER COLUMN started_at SET NOT NULL,
    ADD CONSTRAINT operational_command_node_results_status_check
        CHECK (status IN ('running', 'succeeded', 'failed')),
    ADD CONSTRAINT operational_command_node_results_check CHECK (
        (status = 'running' AND completed_at IS NULL) OR
        (status IN ('succeeded', 'failed') AND completed_at IS NOT NULL)
    );

ALTER TABLE operational_commands
    DROP CONSTRAINT operational_commands_payload_check,
    DROP CONSTRAINT operational_commands_lifecycle_check,
    DROP CONSTRAINT operational_commands_status_check,
    DROP CONSTRAINT operational_commands_command_type_check,
    DROP CONSTRAINT operational_commands_target_scope_check,
    DROP COLUMN started_at,
    DROP COLUMN excluded_nodes,
    DROP COLUMN payload_algorithm,
    DROP COLUMN payload_key_version,
    DROP COLUMN payload_nonce,
    DROP COLUMN payload_ciphertext,
    DROP COLUMN input_fingerprint,
    DROP COLUMN target_node_id,
    DROP COLUMN target_scope,
    ADD CONSTRAINT operational_commands_command_type_check
        CHECK (command_type IN ('dhcp_reset_leases', 'dhcp_reset_configuration')),
    ADD CONSTRAINT operational_commands_status_check
        CHECK (status IN ('running', 'succeeded', 'failed')),
    ADD CONSTRAINT operational_commands_check CHECK (
        (status = 'running' AND completed_at IS NULL AND audit_reference IS NULL) OR
        (status IN ('succeeded', 'failed') AND completed_at IS NOT NULL AND audit_reference IS NOT NULL)
    );
