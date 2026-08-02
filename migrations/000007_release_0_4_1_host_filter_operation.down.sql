DELETE FROM operational_command_node_results
WHERE command_id IN (
    SELECT id FROM operational_commands
    WHERE command_type = 'test_host_filtering'
);
DELETE FROM operational_commands WHERE command_type = 'test_host_filtering';

ALTER TABLE operational_commands
    DROP CONSTRAINT operational_commands_command_type_check,
    ADD CONSTRAINT operational_commands_command_type_check
        CHECK (command_type IN (
            'dhcp_reset_leases', 'dhcp_reset_configuration',
            'test_upstream_dns', 'clear_dns_cache'
        ));
