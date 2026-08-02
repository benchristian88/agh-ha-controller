-- Development-only rollback.  This intentionally fails if schema-v2 records
-- exist, preserving immutable released data rather than deleting it.
ALTER TABLE node_capability_profiles DROP CONSTRAINT IF EXISTS node_capability_profiles_schema_version_check;
ALTER TABLE node_capability_profiles ADD CONSTRAINT node_capability_profiles_schema_version_check CHECK (schema_version = 1);

ALTER TABLE observed_snapshots DROP CONSTRAINT IF EXISTS observed_snapshots_schema_version_check;
ALTER TABLE observed_snapshots ADD CONSTRAINT observed_snapshots_schema_version_check CHECK (schema_version = 1);

ALTER TABLE configuration_drafts DROP CONSTRAINT IF EXISTS configuration_drafts_schema_version_check;
ALTER TABLE configuration_drafts ADD CONSTRAINT configuration_drafts_schema_version_check CHECK (schema_version = 1);

ALTER TABLE configuration_revisions DROP CONSTRAINT IF EXISTS configuration_revisions_schema_version_check;
ALTER TABLE configuration_revisions ADD CONSTRAINT configuration_revisions_schema_version_check CHECK (schema_version = 1);
