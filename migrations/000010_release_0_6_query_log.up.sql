-- Release 0.6 stores privacy-sensitive, normalized query events separately
-- from desired configuration and records restart-safe per-node ingestion state.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE query_ingestion_checkpoints (
    node_id uuid PRIMARY KEY REFERENCES nodes(id) ON DELETE RESTRICT,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    high_watermark_at timestamptz,
    source_newest_at timestamptz,
    source_oldest_at timestamptz,
    last_attempt_at timestamptz NOT NULL,
    last_success_at timestamptz,
    last_status text NOT NULL CHECK (last_status IN (
        'succeeded', 'failed', 'unsupported', 'maintenance', 'logging_disabled'
    )),
    error_code text NOT NULL DEFAULT '',
    gap_detected boolean NOT NULL DEFAULT false,
    gap_reason text NOT NULL DEFAULT '',
    logging_enabled boolean,
    node_version text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL,
    CHECK (last_success_at IS NULL OR last_success_at <= updated_at)
);

CREATE INDEX query_ingestion_checkpoints_cluster_status_idx
    ON query_ingestion_checkpoints (cluster_id, last_status, updated_at DESC);

CREATE TABLE query_ingestion_attempts (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    started_at timestamptz NOT NULL,
    completed_at timestamptz NOT NULL,
    status text NOT NULL CHECK (status IN (
        'succeeded', 'failed', 'unsupported', 'maintenance', 'logging_disabled'
    )),
    error_code text NOT NULL DEFAULT '',
    fetched_records integer NOT NULL DEFAULT 0 CHECK (fetched_records >= 0),
    inserted_records integer NOT NULL DEFAULT 0 CHECK (inserted_records >= 0),
    page_count integer NOT NULL DEFAULT 0 CHECK (page_count >= 0),
    gap_detected boolean NOT NULL DEFAULT false,
    gap_reason text NOT NULL DEFAULT '',
    CHECK (completed_at >= started_at),
    CHECK (inserted_records <= fetched_records)
);

CREATE INDEX query_ingestion_attempts_node_completed_idx
    ON query_ingestion_attempts (node_id, completed_at DESC);
CREATE INDEX query_ingestion_attempts_cluster_completed_idx
    ON query_ingestion_attempts (cluster_id, completed_at DESC);

CREATE TABLE query_events (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    source_timestamp timestamptz NOT NULL,
    ingested_at timestamptz NOT NULL,
    source_fingerprint bytea NOT NULL CHECK (octet_length(source_fingerprint) = 32),
    source_occurrence integer NOT NULL CHECK (source_occurrence > 0),
    query_name text NOT NULL CHECK (query_name <> '' AND length(query_name) <= 1024),
    query_type text NOT NULL CHECK (query_type <> '' AND length(query_type) <= 32),
    client_identifier text NOT NULL CHECK (length(client_identifier) <= 512),
    client_display_name text NOT NULL DEFAULT '' CHECK (length(client_display_name) <= 512),
    client_protocol text NOT NULL DEFAULT '' CHECK (length(client_protocol) <= 32),
    response_status text NOT NULL CHECK (response_status IN (
        'allowed', 'blocked', 'rewritten', 'safe_search', 'safe_browsing',
        'parental', 'error', 'other'
    )),
    response_code text NOT NULL DEFAULT '' CHECK (length(response_code) <= 64),
    elapsed_ms double precision NOT NULL CHECK (
        elapsed_ms >= 0
        AND elapsed_ms != 'Infinity'::double precision
        AND elapsed_ms != '-Infinity'::double precision
        AND elapsed_ms != 'NaN'::double precision
    ),
    upstream text NOT NULL DEFAULT '' CHECK (length(upstream) <= 2048),
    filtering_reason text NOT NULL DEFAULT '' CHECK (length(filtering_reason) <= 128),
    service_name text NOT NULL DEFAULT '' CHECK (length(service_name) <= 256),
    rules jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rules) = 'array'),
    answers jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(answers) = 'array'),
    cached boolean NOT NULL DEFAULT false,
    answer_dnssec boolean NOT NULL DEFAULT false,
    UNIQUE (node_id, source_fingerprint, source_occurrence)
);

CREATE INDEX query_events_cluster_time_idx
    ON query_events (cluster_id, source_timestamp DESC, id DESC);
CREATE INDEX query_events_cluster_node_time_idx
    ON query_events (cluster_id, node_id, source_timestamp DESC, id DESC);
CREATE INDEX query_events_cluster_status_time_idx
    ON query_events (cluster_id, response_status, source_timestamp DESC, id DESC);
CREATE INDEX query_events_cluster_type_time_idx
    ON query_events (cluster_id, query_type, source_timestamp DESC, id DESC);
CREATE INDEX query_events_query_name_trgm_idx
    ON query_events USING gin (lower(query_name) gin_trgm_ops);
CREATE INDEX query_events_client_identifier_trgm_idx
    ON query_events USING gin (lower(client_identifier) gin_trgm_ops);
CREATE INDEX query_events_client_display_name_trgm_idx
    ON query_events USING gin (lower(client_display_name) gin_trgm_ops);
