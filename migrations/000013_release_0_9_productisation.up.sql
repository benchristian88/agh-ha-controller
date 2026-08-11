CREATE TABLE controller_release_cache (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    version text NOT NULL DEFAULT '',
    release_url text NOT NULL DEFAULT '',
    release_notes text NOT NULL DEFAULT '',
    checked_at timestamptz,
    expires_at timestamptz,
    error_code text NOT NULL DEFAULT '',
    CHECK (char_length(version) <= 64),
    CHECK (char_length(release_url) <= 2048),
    CHECK (char_length(release_notes) <= 20000)
);

INSERT INTO controller_release_cache (singleton) VALUES (true);

CREATE TABLE system_settings (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    update_checks_enabled boolean NOT NULL DEFAULT true,
    record_version integer NOT NULL DEFAULT 1 CHECK (record_version > 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO system_settings (singleton) VALUES (true);
