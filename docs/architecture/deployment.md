# Deployment Architecture

## Initial reference topology

```text
LXC 101: agh-node-a
  AdGuard Home
  Optional future log forwarder

LXC 102: agh-node-b
  AdGuard Home
  Optional future log forwarder

LXC 103: agh-ha-controller
  Controller API
  Web UI
  Background workers
  PostgreSQL
```

PostgreSQL may be separated later.

## Network requirements

Controller to node:

- HTTPS access to AdGuard Home administration API.
- Stable node address or resolvable hostname.
- Certificate trust or explicit pinned-certificate policy.

Administrator to controller:

- HTTPS access to the controller UI.
- Optional reverse proxy.

DNS clients to nodes:

- UDP/TCP 53, or encrypted DNS protocols as configured.
- Clients or DHCP should receive both node addresses.

## systemd services

Planned units:

- `agh-ha-controller.service`
- `agh-ha-worker.service`
- `agh-ha-forwarder.service`

The controller and worker may begin as one binary and one service.

## Installation modes

### Debian package or install script

Preferred early community deployment.

### Docker Compose

Supported after the systemd reference deployment is stable.

### Proxmox community LXC script

Planned for the 1.0 release.

## Backup

Back up:

- PostgreSQL.
- Controller encryption key.
- Session secret.
- Runtime configuration.
- TLS certificates.
- Version metadata.

Node configuration remains recoverable from active revisions, but controller secrets are required to reconnect automatically.

## Restore order

1. Restore database.
2. Restore encryption key.
3. Restore controller configuration.
4. Start PostgreSQL.
5. Start controller.
6. Validate node credentials.
7. Run observation without enforcement.
8. Confirm desired state and node state.
9. Re-enable automatic reconciliation.
