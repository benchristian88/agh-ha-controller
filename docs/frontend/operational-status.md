# Operational Status UI

**Administration -> Operational Status** is available at
`/system/operational-status`. Administration owns this page
because the page answers whether Atlas DNS Controller itself is operating correctly; it is
not another DNS configuration or HA lifecycle task.

The page shows overall controller health, API/PostgreSQL status, independent
node observation freshness, per-node Statistics and Query Log health, known
ingestion gaps, process workers, PostgreSQL pool use, and approximate storage
and retention bounds. It uses existing badges, banners, loading/error states,
cards, and responsive data tables. Error codes are safe stable summaries.

Operational Status uses the Standard page class consistently with the other
Administration routes. Its diagnostic grids reflow and its node/subsystem
tables own contained horizontal scrolling instead of widening the page.

Dashboard contains only a compact controller/Statistics/Query Log summary and
links to the page. Statistics and Query Log retain their established coverage
presentations and semantics.

The page includes a compact HA summary and a distinct DNS Service table so
management API reachability and actual DNS answers cannot be conflated. Detailed
maintenance, certificate, version, notification, and upgrade actions live on HA
Operations rather than expanding this diagnostic page.

Core Services uses the shared divided panel anatomy and semantic
`SummaryTileGrid`. API state, PostgreSQL state/ping, schema version,
and pool use remain the same information model, presented as four inset tiles
with the standard compact status badges and responsive two-to-one column flow.
