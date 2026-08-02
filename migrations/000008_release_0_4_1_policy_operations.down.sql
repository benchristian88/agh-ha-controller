DELETE FROM operational_command_node_results
WHERE command_id IN (
    SELECT id FROM operational_commands
    WHERE command_type IN ('clear_query_log', 'reset_statistics')
);
DELETE FROM operational_commands
WHERE command_type IN ('clear_query_log', 'reset_statistics');

ALTER TABLE operational_commands
    DROP CONSTRAINT operational_commands_command_type_check,
    ADD CONSTRAINT operational_commands_command_type_check
        CHECK (command_type IN (
            'dhcp_reset_leases', 'dhcp_reset_configuration',
            'test_upstream_dns', 'test_host_filtering', 'clear_dns_cache'
        ));
