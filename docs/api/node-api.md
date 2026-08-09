# AdGuard Home Node API Adapter

## Release 0.6 Query Log reads

For the explicitly reviewed v0.107.52–v0.107.78 range, Atlas reads
`GET /control/querylog` with `limit` (maximum 500), empty `search`,
`response_status=all`, and the previous response's `oldest` value as
`older_than`. Results are newest-first. Offset exists in portions of the
upstream contract but is intentionally not used because offsets shift while a
live log receives new records. The source supplies timestamps and a timestamp
cursor, not a stable event ID.

The adapter accepts the version-variable `question.name`/legacy
`question.host`, `client`, `client_id`, optional `client_info.name`,
`client_proto`, `elapsedMs` number/string, `status`, `reason`, upstream, answer,
rule/rules/filter ID, service, cache, and DNSSEC fields. It bounds each record
to 64 KiB and normalizes only controller-domain values. Legacy
`GET /control/querylog_info` (including fractional day intervals) and current
`GET /control/querylog/config` are read only for enabled/anonymisation state.

The source can repeat records across overlapping windows, discard history due
to node policy or clear, reset after restart, and cannot distinguish completely
identical events with an ID. Atlas documents and exposes those limitations via
checkpoint/gap coverage; it does not log raw payloads or attempt to reverse
client anonymisation.

## Release 0.2 purpose

The adapter is the only package that consumes raw AdGuard Home HTTP payloads. Release 0.1 performs a read-only status probe at:

```text
GET {baseUrl}/control/status
```

The adapter uses HTTP Basic authentication, requires a bounded request timeout, caps response bodies at 1 MiB, rejects redirects, and returns only the stable domain result:

```go
type NodeProbeResult struct {
    Version       string
    Compatibility Compatibility
    Running       bool
    LatencyMS     int
}
```

Raw payloads and authentication values do not cross the adapter boundary.

## Transport trust

Each node selects one explicit policy:

- `system`: HTTPS using the host system trust store;
- `custom_ca`: HTTPS using system roots plus a stored node-specific private CA;
- `insecure_http`: plaintext HTTP, visibly discouraged and valid only for an `http` URL.

There is no option that skips TLS certificate or hostname verification. Node requests connect directly and do not use ambient proxy configuration, avoiding accidental credential forwarding to an HTTP proxy.

## Compatibility

The tested Release 0.1 contract is AdGuard Home `v0.107.x`. Later versions with the compatible status payload are reported as supported. Older versions are reported as unsupported and malformed or unversioned responses as unknown/incompatible.

Release 0.2 additionally reads `GET /control/dns_info` and `GET /control/filtering/status`. Contract fixtures cover v0.107.52 and v0.107.61. DNS and filtering are the only schema-v1 supported feature areas; unsupported areas are visible rather than silently discarded. All calls remain read-only.

## Release 0.4 configuration contract

Configuration compatibility begins at v0.107.52, but that version remains on frozen schema v1. Schema v2 supports v0.107.53 through the current stable v0.107.78 contract. The adapter reads status, DNS, filtering, persistent clients, rewrites, blocked services, safety/Safe Search, query-log policy, statistics policy, TLS status, and optional DHCP status. Feature flags record each successfully observed area; missing required features block preview before mutation.

| AdGuard Home version | Configuration schema | Managed boundary |
|---|---:|---|
| Earlier than v0.107.52 | Unsupported | Status remains observable, but inventory/deployment is blocked |
| v0.107.52 | 1 | Historical DNS/filtering contract only |
| v0.107.53–v0.107.78 | 2 | Release 0.4 contract; patch-level cache, timeout, filter-interval, rewrite, and ignored-list capabilities are explicit |
| Newer v0.107 or v0.108 contracts | Unknown | Inventory/deployment blocked until fixtures and compatibility rules are updated |

The committed compatibility boundary is contract-tested at v0.107.52/v0.107.53, with the existing v0.107.61 fixtures, and against the v0.107.78 OpenAPI additions. A node can report DHCP unavailable (including platforms where AdGuard Home returns its documented not-implemented status); the capability remains false and DHCP cannot enter that node's desired override.

The writer uses the documented `/control/dns_config`, `/control/filtering/*`, `/control/clients/*`, `/control/rewrite/*`, `/control/blocked_services/update`, safety enable/disable, `/control/safesearch/settings`, `/control/querylog/config/update`, `/control/stats/config/update`, and `/control/dhcp/*` endpoints. Query-log/statistics updates use `PUT`; existing collections are reconciled rather than blindly duplicated. `/control/filtering/refresh` is exposed as a separate audited operation.

Release 0.4.1 additionally reads `GET /control/blocked_services/all` as observed catalogue metadata. v0.107.52–v0.107.67 return `blocked_services` entries with `id`, `name`, `rules`, and Base64 `icon_svg`. From v0.107.68, entries may add `group_id` and the response adds `groups: [{"id": "..."}]`. The adapter accepts both contracts, validates stable IDs/names/groups, and returns only ID, name, and optional group ID. It does not retain rules or icon data, and it never uses deprecated `/blocked_services/services`, `/list`, or `/set` endpoints.

Release 0.4.1 Phase 8A adds two node-specific safety reads. Interface discovery
uses `GET /control/dhcp/interfaces`. The v0.107.78 response is an object keyed
by interface name whose values contain `name`, `hardware_address`,
`ipv4_addresses`, `ipv6_addresses`, `gateway_ip`, and pipe-delimited `flags`.
The adapter returns only those safe values and derives availability in the
controller; the metadata never enters configuration or drift.

Active-DHCP detection uses `POST /control/dhcp/find_active_dhcp` with the exact
body `{ "interface": "eth0" }`. The response contains
`v4.other_server.found`, `v4.static_ip.static`, optional
`v4.static_ip.ip`, and `v6.other_server.found`; protocol result values are
`yes`, `no`, or `error`. Missing protocol data is reported as unavailable.
AdGuard `error` strings and response bodies are never returned, logged, or
stored. Although AdGuard exposes this read-only check as POST, the controller
does not treat it as a configuration mutation.

## Release 0.5 statistics contract

The adapter reads `GET /control/stats/config` and
`GET /control/stats?recent={milliseconds}` only for the explicitly tested
v0.107.72–v0.107.78 exact-range contract. It requests whole-hour fixed ranges
for 24 hours, 7 days, and 30 days only when they do not exceed that node's
configured interval. Earlier configuration-compatible versions retain their
configuration capabilities but report `statistics_exact_range: false` and are
not approximated. A fixed range beyond node retention maps to
`STATISTICS_RANGE_EXCEEDS_NODE_RETENTION` without making the eligible collector
pass fail.

The response boundary accepts `hours` or `days`, non-negative additive totals,
a finite non-negative average processing time, up to 1,000 equal-length
non-negative series points, and up to 100 one-key ranked entries per panel.
Invalid, mismatched, oversized, negative, empty-key, NaN, or infinite data maps
to a safe node-response error. The adapter returns a normalized typed snapshot;
raw JSON and authentication data do not cross into storage.

TLS parsing deliberately has no fields for `certificate_chain`, `private_key`, `certificate_path`, or `private_key_path`. Only public status, subject/issuer, validity, DNS names, ports, and safe warning text cross the adapter boundary. DHCP dynamic leases are observed-only; configuration/static leases are node-specific managed state.

## Error mapping

The adapter distinguishes:

- `NODE_UNREACHABLE` for bounded network and timeout failures;
- `NODE_TLS_FAILED` for certificate, hostname, or TLS handshake failures;
- `NODE_AUTHENTICATION_FAILED` for HTTP 401 or 403;
- `NODE_INVALID_RESPONSE` for other status codes, oversized bodies, or malformed payloads.

Messages are safe for API responses and never include the supplied credentials or node response body.
