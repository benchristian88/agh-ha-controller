-- Release 0.8 keeps lifecycle state separate from desired configuration,
-- immutable revisions, observations, and deployment results.
CREATE TABLE node_lifecycle_settings (
    node_id uuid PRIMARY KEY REFERENCES nodes(id) ON DELETE RESTRICT,
    dns_probe_host text NOT NULL DEFAULT '',
    dns_probe_port integer NOT NULL DEFAULT 53 CHECK (dns_probe_port BETWEEN 1 AND 65535),
    dns_probe_name text NOT NULL DEFAULT '.',
    dns_probe_type text NOT NULL DEFAULT 'NS' CHECK (dns_probe_type IN ('A', 'AAAA', 'NS')),
    expected_rcode integer NOT NULL DEFAULT 0 CHECK (expected_rcode BETWEEN 0 AND 15),
    probe_udp boolean NOT NULL DEFAULT true,
    probe_tcp boolean NOT NULL DEFAULT true,
    installation_type text NOT NULL DEFAULT 'unknown'
        CHECK (installation_type IN ('native_systemd', 'docker', 'home_assistant_addon', 'custom', 'unknown')),
    record_version integer NOT NULL DEFAULT 1 CHECK (record_version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (char_length(dns_probe_host) <= 255),
    CHECK (char_length(dns_probe_name) BETWEEN 1 AND 253),
    CHECK (probe_udp OR probe_tcp)
);

CREATE TABLE dns_probe_results (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    status text NOT NULL CHECK (status IN ('healthy', 'failed')),
    udp_status text NOT NULL CHECK (udp_status IN ('healthy', 'failed', 'disabled')),
    tcp_status text NOT NULL CHECK (tcp_status IN ('healthy', 'failed', 'disabled')),
    response_code integer CHECK (response_code IS NULL OR response_code BETWEEN 0 AND 15),
    latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
    address_family text NOT NULL DEFAULT '' CHECK (address_family IN ('', 'ipv4', 'ipv6')),
    error_code text NOT NULL DEFAULT '',
    probed_at timestamptz NOT NULL
);

CREATE INDEX dns_probe_results_node_time_idx ON dns_probe_results (node_id, probed_at DESC);
CREATE INDEX dns_probe_results_cluster_time_idx ON dns_probe_results (cluster_id, probed_at DESC);
CREATE INDEX dns_probe_results_retention_idx ON dns_probe_results (probed_at, id);

CREATE TABLE ha_operational_events (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    node_id uuid REFERENCES nodes(id) ON DELETE RESTRICT,
    event_type text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    summary text NOT NULL,
    details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL,
    CHECK (char_length(event_type) BETWEEN 1 AND 80),
    CHECK (char_length(summary) BETWEEN 1 AND 500),
    CHECK (jsonb_typeof(details_json) = 'object')
);

CREATE INDEX ha_operational_events_cluster_time_idx ON ha_operational_events (cluster_id, occurred_at DESC, id DESC);
CREATE INDEX ha_operational_events_node_time_idx ON ha_operational_events (node_id, occurred_at DESC, id DESC) WHERE node_id IS NOT NULL;
CREATE INDEX ha_operational_events_type_time_idx ON ha_operational_events (event_type, occurred_at DESC);
CREATE INDEX ha_operational_events_retention_idx ON ha_operational_events (occurred_at, id);

CREATE TABLE upgrade_operations (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    from_version text NOT NULL,
    target_version text NOT NULL,
    installation_type text NOT NULL
        CHECK (installation_type IN ('native_systemd', 'docker', 'home_assistant_addon', 'custom', 'unknown')),
    mode text NOT NULL CHECK (mode IN ('guided')),
    status text NOT NULL
        CHECK (status IN ('planned', 'maintenance', 'awaiting_operator', 'validating', 'succeeded', 'failed', 'cancelled')),
    requested_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    request_id text NOT NULL,
    preflight_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    validation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_code text NOT NULL DEFAULT '',
    error_summary text NOT NULL DEFAULT '',
    started_at timestamptz NOT NULL,
    completed_at timestamptz,
    CHECK (char_length(from_version) <= 128),
    CHECK (char_length(target_version) BETWEEN 1 AND 128),
    CHECK (char_length(error_summary) <= 500),
    CHECK (jsonb_typeof(preflight_json) = 'object'),
    CHECK (jsonb_typeof(validation_json) = 'object')
);

CREATE INDEX upgrade_operations_cluster_time_idx ON upgrade_operations (cluster_id, started_at DESC);
CREATE INDEX upgrade_operations_node_time_idx ON upgrade_operations (node_id, started_at DESC);
CREATE UNIQUE INDEX upgrade_operations_one_active_node_idx ON upgrade_operations (node_id)
    WHERE status IN ('planned', 'maintenance', 'awaiting_operator', 'validating');

CREATE TABLE upstream_release_cache (
    product text PRIMARY KEY CHECK (product = 'adguard_home'),
    version text NOT NULL,
    release_url text NOT NULL DEFAULT '',
    compatibility text NOT NULL CHECK (compatibility IN ('supported', 'unknown', 'unsupported')),
    checked_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    error_code text NOT NULL DEFAULT '',
    CHECK (expires_at > checked_at)
);

CREATE TABLE notification_channels (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    name text NOT NULL,
    channel_type text NOT NULL CHECK (channel_type = 'webhook'),
    enabled boolean NOT NULL DEFAULT true,
    encrypted_destination bytea NOT NULL,
    destination_nonce bytea NOT NULL,
    destination_key_version integer NOT NULL,
    destination_algorithm text NOT NULL,
    record_version integer NOT NULL DEFAULT 1 CHECK (record_version > 0),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CHECK (char_length(name) BETWEEN 1 AND 120),
    UNIQUE (cluster_id, name)
);

CREATE TABLE notification_deliveries (
    id uuid PRIMARY KEY,
    channel_id uuid NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    event_id uuid NOT NULL REFERENCES ha_operational_events(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'suppressed')),
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
    error_code text NOT NULL DEFAULT '',
    next_attempt_at timestamptz,
    created_at timestamptz NOT NULL,
    completed_at timestamptz,
    UNIQUE (channel_id, event_id)
);

CREATE INDEX notification_deliveries_pending_idx ON notification_deliveries (next_attempt_at, created_at)
    WHERE status IN ('pending', 'failed') AND attempt_count < 5;
