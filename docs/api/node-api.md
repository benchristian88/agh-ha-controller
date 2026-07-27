# AdGuard Home Node API Adapter

## Release 0.1 purpose

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

This compatibility statement covers only status and version. Configuration capability discovery is Release 0.2 scope.

## Error mapping

The adapter distinguishes:

- `NODE_UNREACHABLE` for bounded network and timeout failures;
- `NODE_TLS_FAILED` for certificate, hostname, or TLS handshake failures;
- `NODE_AUTHENTICATION_FAILED` for HTTP 401 or 403;
- `NODE_INVALID_RESPONSE` for other status codes, oversized bodies, or malformed payloads.

Messages are safe for API responses and never include the supplied credentials or node response body.
