# Database ERD — implemented through Release 0.4

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : has
    USERS ||--o{ CONFIGURATION_REVISIONS : creates
	USERS ||--o{ AUDIT_EVENTS : acts_in
    CLUSTERS ||--o{ NODES : contains
	CLUSTERS ||--o| CONFIGURATION_DRAFTS : owns
    CLUSTERS ||--o{ CONFIGURATION_REVISIONS : owns
    CLUSTERS ||--o{ DEPLOYMENTS : runs
    CONFIGURATION_REVISIONS ||--o{ DEPLOYMENTS : deployed_as
    DEPLOYMENTS ||--o{ DEPLOYMENT_NODES : targets
    NODES ||--o{ DEPLOYMENT_NODES : receives
    NODES ||--o{ OBSERVED_SNAPSHOTS : produces
	NODES ||--o| NODE_CAPABILITY_PROFILES : has
    NODES ||--o{ DRIFT_EVENTS : experiences
	CONFIGURATION_REVISIONS ||--o{ DRIFT_EVENTS : desired_for
	OBSERVED_SNAPSHOTS ||--o{ DRIFT_EVENTS : detected_from
```

Statistics and query-event tables remain planned for Releases 0.5 and 0.6 and are intentionally absent from this implemented ERD.

Release 0.4 adds no entities or relationships. Migration `000004_release_0_4` permits immutable configuration schema versions 1 and 2 in the existing draft, revision, snapshot, and capability-profile records; it does not rewrite historical payloads.
