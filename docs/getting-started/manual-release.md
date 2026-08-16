# Install from a release archive

This advanced path installs the same prebuilt Linux amd64/arm64 bundle consumed
by the systemd installer.

1. Select an exact GitHub Release and matching architecture archive.
2. Download the archive and `checksums.txt` over HTTPS.
3. Verify the matching checksum before extraction.
4. Extract the versioned top-level directory.
5. Read `README.md` and `LICENSE`.
6. Install the three files under `bin/`, serve the bundled `web/` directory via
   `WEB_DIST_DIR`, and provide the documented runtime environment.

Example for Linux amd64:

```bash
version=1.0.1
curl -fsSLO "https://github.com/benchristian88/atlas-dns/releases/download/v${version}/atlas-dns_${version}_linux_amd64.tar.gz"
curl -fsSLO "https://github.com/benchristian88/atlas-dns/releases/download/v${version}/checksums.txt"
grep " atlas-dns_${version}_linux_amd64.tar.gz$" checksums.txt | sha256sum --check
tar -xzf "atlas-dns_${version}_linux_amd64.tar.gz"
```

The bundle includes the controller, backup and migration commands, frontend,
systemd unit, README, and BUSL-1.1 licence. A bare controller binary without the
matching frontend is not a complete native distribution.

For a supervised manual run, provision PostgreSQL 17, export the stable runtime
values from [`.env.example`](../../.env.example), set `WEB_DIST_DIR` to the
bundle's `web/` directory, and run the matching migration/controller binaries:

```bash
export APP_ENV=production
export INSTALLATION_TYPE=manual
export HTTP_ADDR=:8080
export WEB_DIST_DIR="$PWD/atlas-dns_1.0.1_linux_amd64/web"
export DATABASE_URL='postgres://atlas_dns:URL_SAFE_PASSWORD@127.0.0.1:5432/atlas_dns?sslmode=disable'
export PUBLIC_BASE_URL='https://controller.example.test'
export SESSION_SECRET='replace-with-openssl-rand-base64-48'
export CREDENTIAL_ENCRYPTION_KEY='replace-with-openssl-rand-base64-32'
export AUTO_MIGRATE=true
./atlas-dns_1.0.1_linux_amd64/bin/atlas-dns
```

Do not place real secret values in shell history. Prefer a protected service
environment file or secret manager, and terminate browser traffic with trusted
HTTPS. Verify `/health`, `/ready`, About version/schema, and initial login.

Manual process supervision, PostgreSQL provisioning, permissions, TLS, updates,
and recovery remain the operator's responsibility. Debian operators should
prefer the verified [systemd installer](native-systemd.md).
