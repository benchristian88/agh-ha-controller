ALTER TABLE notification_deliveries
    DROP CONSTRAINT notification_deliveries_channel_id_fkey;

DELETE FROM notification_deliveries WHERE channel_id IS NULL;

ALTER TABLE notification_deliveries
    ALTER COLUMN channel_id SET NOT NULL,
    ADD CONSTRAINT notification_deliveries_channel_id_fkey
        FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE,
    DROP COLUMN channel_name;

ALTER TABLE notification_channels DROP COLUMN destination_summary;

DROP INDEX deployments_cluster_archive_idx;
ALTER TABLE deployments
    DROP CONSTRAINT deployments_archive_pair_check,
    DROP COLUMN archived_by,
    DROP COLUMN archived_at;

DROP INDEX configuration_revisions_cluster_archive_idx;
ALTER TABLE configuration_revisions
    DROP CONSTRAINT configuration_revisions_archive_pair_check,
    DROP COLUMN archived_by,
    DROP COLUMN archived_at;
