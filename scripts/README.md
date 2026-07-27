# Scripts

## Implemented

- `local-test-env.sh`: sourceable, public fixture environment for the disposable Release 0.1 PostgreSQL and two-node setup.

Use it only after `make test-env-up`:

```bash
. ./scripts/local-test-env.sh
```

Environment lifecycle, migration, test, and build commands live in the root Makefile so local and CI execution use the same entry points.

## Planned

- Release checksum generation.
- Proxmox LXC installer.
- Automated backup and restore helpers.
