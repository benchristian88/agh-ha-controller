# AdGuard Home Node API Adapter

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

TLS parsing deliberately has no fields for `certificate_chain`, `private_key`, `certificate_path`, or `private_key_path`. Only public status, subject/issuer, validity, DNS names, ports, and safe warning text cross the adapter boundary. DHCP dynamic leases are observed-only; configuration/static leases are node-specific managed state.

## Error mapping

The adapter distinguishes:

- `NODE_UNREACHABLE` for bounded network and timeout failures;
- `NODE_TLS_FAILED` for certificate, hostname, or TLS handshake failures;
- `NODE_AUTHENTICATION_FAILED` for HTTP 401 or 403;
- `NODE_INVALID_RESPONSE` for other status codes, oversized bodies, or malformed payloads.

Messages are safe for API responses and never include the supplied credentials or node response body.
