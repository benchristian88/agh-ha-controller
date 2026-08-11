ALTER TABLE configuration_revisions
    ADD COLUMN archived_at timestamptz,
    ADD COLUMN archived_by uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT configuration_revisions_archive_pair_check
        CHECK (archived_at IS NOT NULL OR archived_by IS NULL);

CREATE INDEX configuration_revisions_cluster_archive_idx
    ON configuration_revisions (cluster_id, archived_at, revision_number DESC);

ALTER TABLE deployments
    ADD COLUMN archived_at timestamptz,
    ADD COLUMN archived_by uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT deployments_archive_pair_check
        CHECK (archived_at IS NOT NULL OR archived_by IS NULL);

CREATE INDEX deployments_cluster_archive_idx
    ON deployments (cluster_id, archived_at, requested_at DESC);

ALTER TABLE notification_channels
    ADD COLUMN destination_summary text NOT NULL DEFAULT '';

ALTER TABLE notification_deliveries
    ADD COLUMN channel_name text NOT NULL DEFAULT '';

UPDATE notification_deliveries AS delivery
SET channel_name = channel.name
FROM notification_channels AS channel
WHERE channel.id = delivery.channel_id;

ALTER TABLE notification_deliveries
    DROP CONSTRAINT notification_deliveries_channel_id_fkey,
    ALTER COLUMN channel_id DROP NOT NULL,
    ADD CONSTRAINT notification_deliveries_channel_id_fkey
        FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE SET NULL;
