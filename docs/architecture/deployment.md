# Deployment Architecture

The reference topology uses at least two independently serving AdGuard Home
nodes and one controller/PostgreSQL management host. PostgreSQL may run on the
controller host or a separately protected database host.

```text
DNS clients ──→ AdGuard Home node A
           └──→ AdGuard Home node B (or additional nodes)

Administrators ──HTTPS──→ controller/API/workers ──SQL──→ PostgreSQL 17
                                     └──HTTPS API──→ each AdGuard Home node
```

## Network requirements

- Administrators reach one HTTPS controller origin.
- The controller reaches each AdGuard Home administration API over a stable,
  trusted address.
- DNS clients receive node addresses and query nodes directly over the protocols
  those nodes provide.
- The controller binds no DNS port and needs no node-side agent or remote shell.

## Runtime modes

The Go controller/API/workers and built frontend run as one application process.
Supported reference packaging is:

- [Docker Engine with Compose v2](../getting-started/docker.md): unprivileged
  read-only controller container, PostgreSQL 17 volume, no Docker socket.
- [Debian 13 with systemd](../getting-started/native-systemd.md): dedicated
  non-login service account, protected environment, hardened unit.

Those guides are the only authoritative install/upgrade command sources.

## Configuration deployment

The worker validates and observes every target before mutation, then applies one
node at a time and reads it back. Within a schema-v2 node task it reconciles
filtering, lists, rules, clients, rewrites, safety/services, telemetry policy,
DNS, and node-specific DHCP before verification. DHCP ownership handoff orders
desired-disabled nodes before the desired-active node. It skips an unnecessary
DHCP writer call when managed fields already match.

Failure stops later nodes and records only safe method/controller-owned operation
path/status diagnostics. It never stores the node response body, request payload,
credentials, or endpoint authority. Only total verified success activates the
revision.

## Recovery boundary

Portable backups protect database control-plane state and the credential key;
runtime origin/session/TLS settings remain installation configuration. Restore
is offline to a new empty database. Follow [Backup and Restore](../operations/backup-and-restore.md)
and keep reconciliation non-enforcing until desired and observed state are
reviewed.
