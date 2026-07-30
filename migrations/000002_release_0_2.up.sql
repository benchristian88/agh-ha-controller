CREATE TABLE node_capability_profiles (
    node_id uuid PRIMARY KEY REFERENCES nodes(id) ON DELETE RESTRICT,
    product_version text NOT NULL,
    api_compatibility text NOT NULL CHECK (api_compatibility IN ('supported', 'unsupported', 'unknown')),
    schema_version integer NOT NULL CHECK (schema_version = 1),
    features_json jsonb NOT NULL,
    warnings_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    refreshed_at timestamptz NOT NULL,
    CHECK (jsonb_typeof(features_json) = 'object'),
    CHECK (jsonb_typeof(warnings_json) = 'array')
);

CREATE TABLE observed_snapshots (
    id uuid PRIMARY KEY,
    node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    observed_at timestamptz NOT NULL,
    schema_version integer NOT NULL CHECK (schema_version = 1),
    document_json jsonb,
    canonical_hash text,
    node_version text NOT NULL DEFAULT '',
    collection_status text NOT NULL CHECK (collection_status IN ('succeeded', 'failed')),
    error_code text NOT NULL DEFAULT '',
    CHECK (
        (collection_status = 'succeeded' AND document_json IS NOT NULL AND canonical_hash IS NOT NULL) OR
        (collection_status = 'failed' AND document_json IS NULL AND canonical_hash IS NULL AND error_code <> '')
    )
);

CREATE INDEX observed_snapshots_node_observed_idx ON observed_snapshots (node_id, observed_at DESC);

CREATE TABLE configuration_drafts (
    id uuid PRIMARY KEY,
    cluster_id uuid NOT NULL UNIQUE REFERENCES clusters(id) ON DELETE RESTRICT,
    source_snapshot_id uuid NOT NULL REFERENCES observed_snapshots(id) ON DELETE RESTRICT,
    schema_version integer NOT NULL CHECK (schema_version = 1),
    document_json jsonb NOT NULL,
    canonical_hash text NOT NULL,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    updated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL,
    CHECK (jsonb_typeof(document_json) = 'object')
);
