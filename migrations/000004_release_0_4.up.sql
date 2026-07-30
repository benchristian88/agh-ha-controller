-- Release 0.4 introduces canonical configuration schema v2.  Existing schema
-- v1 observations and immutable revisions remain valid and are not rewritten.
ALTER TABLE node_capability_profiles DROP CONSTRAINT IF EXISTS node_capability_profiles_schema_version_check;
ALTER TABLE node_capability_profiles ADD CONSTRAINT node_capability_profiles_schema_version_check CHECK (schema_version IN (1, 2));

ALTER TABLE observed_snapshots DROP CONSTRAINT IF EXISTS observed_snapshots_schema_version_check;
ALTER TABLE observed_snapshots ADD CONSTRAINT observed_snapshots_schema_version_check CHECK (schema_version IN (1, 2));

ALTER TABLE configuration_drafts DROP CONSTRAINT IF EXISTS configuration_drafts_schema_version_check;
ALTER TABLE configuration_drafts ADD CONSTRAINT configuration_drafts_schema_version_check CHECK (schema_version IN (1, 2));

ALTER TABLE configuration_revisions DROP CONSTRAINT IF EXISTS configuration_revisions_schema_version_check;
ALTER TABLE configuration_revisions ADD CONSTRAINT configuration_revisions_schema_version_check CHECK (schema_version IN (1, 2));
