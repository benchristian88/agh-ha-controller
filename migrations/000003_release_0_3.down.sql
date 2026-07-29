DROP TABLE IF EXISTS drift_events;
DROP TABLE IF EXISTS deployment_nodes;
DROP TABLE IF EXISTS deployments;
ALTER TABLE configuration_drafts DROP COLUMN IF EXISTS base_revision_id;
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_applied_revision_fk;
ALTER TABLE clusters DROP CONSTRAINT IF EXISTS clusters_active_revision_fk;
DROP TABLE IF EXISTS configuration_revisions;
ALTER TABLE nodes
    DROP COLUMN IF EXISTS maintenance_mode,
    DROP COLUMN IF EXISTS applied_revision_id,
    DROP COLUMN IF EXISTS applied_hash,
    DROP COLUMN IF EXISTS convergence_status,
    DROP COLUMN IF EXISTS last_reconciled_at;
ALTER TABLE clusters
    DROP COLUMN IF EXISTS reconciliation_policy,
    DROP COLUMN IF EXISTS active_revision_id;
