-- Release 0.4.1 Phase 9C-2 adds the non-mutating host-filtering test to the
-- shared durable operational-command queue. Its input remains encrypted.
ALTER TABLE operational_commands
    DROP CONSTRAINT operational_commands_command_type_check,
    ADD CONSTRAINT operational_commands_command_type_check
        CHECK (command_type IN (
            'dhcp_reset_leases', 'dhcp_reset_configuration',
            'test_upstream_dns', 'test_host_filtering', 'clear_dns_cache'
        ));
