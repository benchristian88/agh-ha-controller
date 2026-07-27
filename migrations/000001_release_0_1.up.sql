CREATE TABLE users (
    id uuid PRIMARY KEY,
    email text NOT NULL,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('administrator')),
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz,
    CHECK (email = lower(email)),
    CHECK (char_length(display_name) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash bytea NOT NULL UNIQUE,
    csrf_hash bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    ip_metadata text NOT NULL DEFAULT '',
    user_agent text NOT NULL DEFAULT '',
    CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE clusters (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (char_length(name) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX clusters_name_unique ON clusters (lower(name));

CREATE TABLE nodes (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL REFERENCES clusters(id) ON DELETE RESTRICT,
    name text NOT NULL,
    base_url text NOT NULL,
    encrypted_credentials bytea NOT NULL,
    credential_nonce bytea NOT NULL,
    credential_key_version integer NOT NULL,
    credential_algorithm text NOT NULL,
    certificate_policy text NOT NULL CHECK (certificate_policy IN ('system', 'custom_ca', 'insecure_http')),
    custom_ca_pem text NOT NULL DEFAULT '',
    enabled boolean NOT NULL DEFAULT true,
    health_status text NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('unknown', 'healthy', 'unreachable', 'incompatible', 'disabled')),
    compatibility_status text NOT NULL DEFAULT 'unknown' CHECK (compatibility_status IN ('unknown', 'supported', 'unsupported')),
    version text NOT NULL DEFAULT '',
    last_seen_at timestamptz,
    last_polled_at timestamptz,
    latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
    last_error_code text NOT NULL DEFAULT '',
    record_version integer NOT NULL DEFAULT 1 CHECK (record_version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK (char_length(name) BETWEEN 1 AND 120),
    CHECK (
        (certificate_policy = 'custom_ca' AND custom_ca_pem <> '') OR
        (certificate_policy <> 'custom_ca' AND custom_ca_pem = '')
    )
);

CREATE UNIQUE INDEX nodes_cluster_name_unique ON nodes (cluster_id, lower(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX nodes_cluster_url_unique ON nodes (cluster_id, base_url) WHERE deleted_at IS NULL;
CREATE INDEX nodes_cluster_health_idx ON nodes (cluster_id, health_status) WHERE deleted_at IS NULL;
CREATE INDEX nodes_polling_idx ON nodes (enabled, last_polled_at) WHERE deleted_at IS NULL;

CREATE TABLE audit_events (
    id uuid PRIMARY KEY,
    actor_type text NOT NULL CHECK (actor_type IN ('user', 'system', 'anonymous')),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    request_id text NOT NULL,
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE INDEX audit_events_created_at_idx ON audit_events (created_at DESC);
CREATE INDEX audit_events_resource_idx ON audit_events (resource_type, resource_id, created_at DESC);
CREATE INDEX audit_events_actor_idx ON audit_events (actor_user_id, created_at DESC);
