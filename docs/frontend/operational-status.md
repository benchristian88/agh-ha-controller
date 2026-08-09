# Operational Status UI

Release 0.7 implements **Administration -> Operational Status** at
`/system/operational-status`. Administration is the appropriate location
because the page answers whether Atlas itself is operating correctly; it is
not another DNS configuration or HA lifecycle task.

The page shows overall controller health, API/PostgreSQL status, independent
node observation freshness, per-node Statistics and Query Log health, known
ingestion gaps, process workers, PostgreSQL pool use, and approximate storage
and retention bounds. It uses existing badges, banners, loading/error states,
cards, and responsive data tables. Error codes are safe stable summaries.

Dashboard contains only a compact controller/Statistics/Query Log summary and
links to the page. Statistics and Query Log retain their established coverage
presentations and semantics.
