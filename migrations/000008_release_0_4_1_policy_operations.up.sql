-- Release 0.4.1 Phase 9C-3 adds destructive Query Log clearing and Statistics
-- reset commands to the shared durable operational-command queue.
ALTER TABLE operational_commands
    DROP CONSTRAINT operational_commands_command_type_check,
    ADD CONSTRAINT operational_commands_command_type_check
        CHECK (command_type IN (
            'dhcp_reset_leases', 'dhcp_reset_configuration',
            'test_upstream_dns', 'test_host_filtering', 'clear_dns_cache',
            'clear_query_log', 'reset_statistics'
        ));
