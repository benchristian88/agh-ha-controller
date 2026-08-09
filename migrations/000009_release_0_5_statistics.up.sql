-- Release 0.5 stores normalized, immutable node statistics separately from
-- collection evidence and overlap-safe time buckets.
CREATE TABLE statistics_poll_attempts (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    started_at timestamptz NOT NULL,
    completed_at timestamptz NOT NULL,
    status text NOT NULL CHECK (status IN ('succeeded', 'partial', 'failed', 'unsupported', 'maintenance')),
    error_code text NOT NULL DEFAULT '',
    range_errors jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(range_errors) = 'object'),
    expected_ranges integer NOT NULL CHECK (expected_ranges > 0),
    collected_ranges integer NOT NULL CHECK (collected_ranges >= 0 AND collected_ranges <= expected_ranges),
    CHECK (completed_at >= started_at)
);

CREATE INDEX statistics_poll_attempts_node_completed_idx
    ON statistics_poll_attempts (node_id, completed_at DESC);
CREATE INDEX statistics_poll_attempts_cluster_completed_idx
    ON statistics_poll_attempts (cluster_id, completed_at DESC);

CREATE TABLE statistics_snapshots (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    range_key text NOT NULL CHECK (range_key IN ('24h', '7d', '30d')),
    source_started_at timestamptz NOT NULL,
    source_ended_at timestamptz NOT NULL,
    collected_at timestamptz NOT NULL,
    node_version text NOT NULL,
    time_unit text NOT NULL CHECK (time_unit IN ('hours', 'days')),
    dns_queries bigint NOT NULL CHECK (dns_queries >= 0),
    blocked_filtering bigint NOT NULL CHECK (blocked_filtering >= 0),
    replaced_safebrowsing bigint NOT NULL CHECK (replaced_safebrowsing >= 0),
    replaced_safesearch bigint NOT NULL CHECK (replaced_safesearch >= 0),
    replaced_parental bigint NOT NULL CHECK (replaced_parental >= 0),
    average_processing_seconds double precision NOT NULL CHECK (
        average_processing_seconds >= 0
        AND average_processing_seconds != 'Infinity'::double precision
        AND average_processing_seconds != '-Infinity'::double precision
        AND average_processing_seconds != 'NaN'::double precision
    ),
    top_queried_domains jsonb NOT NULL CHECK (jsonb_typeof(top_queried_domains) = 'array'),
    top_blocked_domains jsonb NOT NULL CHECK (jsonb_typeof(top_blocked_domains) = 'array'),
    top_clients jsonb NOT NULL CHECK (jsonb_typeof(top_clients) = 'array'),
    top_upstream_responses jsonb NOT NULL CHECK (jsonb_typeof(top_upstream_responses) = 'array'),
    top_upstream_average_seconds jsonb NOT NULL CHECK (jsonb_typeof(top_upstream_average_seconds) = 'array'),
    dns_queries_series jsonb NOT NULL CHECK (jsonb_typeof(dns_queries_series) = 'array'),
    blocked_filtering_series jsonb NOT NULL CHECK (jsonb_typeof(blocked_filtering_series) = 'array'),
    replaced_safebrowsing_series jsonb NOT NULL CHECK (jsonb_typeof(replaced_safebrowsing_series) = 'array'),
    replaced_parental_series jsonb NOT NULL CHECK (jsonb_typeof(replaced_parental_series) = 'array'),
    CHECK (source_ended_at > source_started_at),
    CHECK (collected_at >= source_started_at)
);

CREATE UNIQUE INDEX statistics_snapshots_node_range_collected_idx
    ON statistics_snapshots (node_id, range_key, collected_at);
CREATE INDEX statistics_snapshots_cluster_range_latest_idx
    ON statistics_snapshots (cluster_id, range_key, collected_at DESC);

CREATE TABLE statistics_buckets (
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    resolution text NOT NULL CHECK (resolution IN ('hour', 'day')),
    bucket_start timestamptz NOT NULL,
    dns_queries bigint NOT NULL CHECK (dns_queries >= 0),
    blocked_filtering bigint NOT NULL CHECK (blocked_filtering >= 0),
    replaced_safebrowsing bigint NOT NULL CHECK (replaced_safebrowsing >= 0),
    replaced_parental bigint NOT NULL CHECK (replaced_parental >= 0),
    collected_at timestamptz NOT NULL,
    PRIMARY KEY (node_id, resolution, bucket_start)
);

CREATE INDEX statistics_buckets_cluster_resolution_time_idx
    ON statistics_buckets (cluster_id, resolution, bucket_start DESC);
