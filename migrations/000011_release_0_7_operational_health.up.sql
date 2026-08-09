-- Release 0.7 operational status reads global retained time bounds without
-- scanning the high-volume Statistics and Query Log tables.
CREATE INDEX statistics_snapshots_collected_at_idx
    ON statistics_snapshots (collected_at);

CREATE INDEX query_events_source_timestamp_retention_idx
    ON query_events (source_timestamp, id);
