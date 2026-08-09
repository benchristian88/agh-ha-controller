# ADR-0030: Coordinate HA lifecycle without owning node upgrades

Status: Accepted

Date: 2026-08-09

## Context

AGH HA Controller must make planned maintenance and AdGuard Home upgrades safer while
remaining agentless and outside the DNS request path. AdGuard Home exposes
health and configuration APIs, but it does not expose a portable authenticated
upgrade API. Native/systemd, Docker, Home Assistant add-on, and custom installs
also have different package ownership and rollback mechanisms.

## Decision

AGH HA Controller actively queries each node's DNS listener over UDP and TCP and keeps that
evidence separate from management API reachability. It derives an N-node HA
summary, records state transitions, and gates maintenance on verified remaining
DNS capacity, active deployments, and DHCP ownership.

Return to service is fail-closed. AGH HA Controller requires authenticated API access, a
fresh capability/configuration observation, the configured DNS queries, no open
drift, the active revision applied, non-expired TLS inventory, safe DHCP state,
and resumable configured collectors before clearing maintenance.

Upgrade execution is guided in Release 0.8. Native/systemd and Docker installs
are supported as operator-executed workflows: AGH HA Controller freezes the target in
maintenance, records the intended version, then validates the version and all
return-to-service checks. Home Assistant add-on, custom, and unknown installs
are reported as unsupported. AGH HA Controller does not install packages, run remote shell,
restart containers, or claim automatic rollback.

Notifications use encrypted HTTPS webhook destinations. They are queued from
durable transition events, suppress expected per-node DNS failures during
maintenance, retry with bounds, and never include credentials, raw node errors,
DNS query contents, or destination URLs in API responses or logs.

## Consequences

- A controller outage cannot interrupt DNS serving.
- API reachability cannot hide a failed DNS listener.
- Maintenance and upgrade failures leave the node in maintenance for operator
  recovery.
- A one-node installation needs the exact break-glass phrase
  `CONTINUE_WITHOUT_DNS_REDUNDANCY` before maintenance.
- Automatic package/container upgrades require a future authenticated execution
  boundary and a new architecture decision.
