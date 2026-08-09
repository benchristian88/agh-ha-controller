# Operational Status UI

Release 0.7 implements **Administration -> Operational Status** at
`/system/operational-status`. Administration is the appropriate location
because the page answers whether AGH HA Controller itself is operating correctly; it is
not another DNS configuration or HA lifecycle task.

The page shows overall controller health, API/PostgreSQL status, independent
node observation freshness, per-node Statistics and Query Log health, known
ingestion gaps, process workers, PostgreSQL pool use, and approximate storage
and retention bounds. It uses existing badges, banners, loading/error states,
cards, and responsive data tables. Error codes are safe stable summaries.

Dashboard contains only a compact controller/Statistics/Query Log summary and
links to the page. Statistics and Query Log retain their established coverage
presentations and semantics.

Release 0.8 adds a compact HA summary and a distinct DNS Service table here so
management API reachability and actual DNS answers cannot be conflated. Detailed
maintenance, certificate, version, notification, and upgrade actions live on HA
Operations rather than expanding this diagnostic page.
