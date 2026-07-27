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

Release 0.1 implements `agh-ha-controller.service` as the combined API and worker process. The installation must place:

- `agh-ha-controller` in `/usr/local/bin`;
- the Vite `web/dist` contents in `/usr/local/share/agh-ha-controller/web`;
- runtime secrets in `/etc/agh-ha-controller/agh-ha-controller.env` readable only by the service account.

The service does not bind any DNS port. Browser HTTPS is normally terminated by a local reverse proxy in 0.1; `PUBLIC_BASE_URL` must still be the externally visible HTTPS URL so session cookies are marked Secure.

## Installation modes

### Debian package or install script

Preferred early community deployment.

### Docker Compose

Supported after the systemd reference deployment is stable.

The repository-root `compose.test.yml` is a Release 0.1 development and CI fixture only. It supplies PostgreSQL and two status-contract simulators while the controller runs from source on the host. It is deliberately not a controller deployment image and does not change the systemd-first decision in ADR-0014.

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
