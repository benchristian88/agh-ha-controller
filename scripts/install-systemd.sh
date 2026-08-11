#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer as root." >&2
  exit 1
fi

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
for command_name in go npm make install openssl runuser systemctl pg_dump pg_restore; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  }
done
command -v psql >/dev/null 2>&1 || {
  echo "PostgreSQL client/server tools are required (install postgresql)." >&2
  exit 1
}
pg_dump_version=$(pg_dump --version | awk '{print $NF}')
pg_restore_version=$(pg_restore --version | awk '{print $NF}')
if [[ ${pg_dump_version%%.*} != 17 || ${pg_restore_version%%.*} != 17 ]]; then
  echo "PostgreSQL 17 pg_dump and pg_restore are required for portable backup compatibility." >&2
  exit 1
fi

public_base_url=${PUBLIC_BASE_URL:-}
if [[ -z ${public_base_url} ]]; then
  echo "Set PUBLIC_BASE_URL to the browser-visible origin, for example https://controller.example.test" >&2
  exit 1
fi

service_user=aghha
service_group=aghha
database_name=${POSTGRES_DB:-aghha}
database_user=${POSTGRES_USER:-aghha}
environment_dir=/etc/agh-ha-controller
environment_file=${environment_dir}/agh-ha-controller.env
state_dir=/var/lib/agh-ha-controller
web_dir=/usr/local/share/agh-ha-controller/web

if ! getent group "${service_group}" >/dev/null; then
  groupadd --system "${service_group}"
fi
if ! id "${service_user}" >/dev/null 2>&1; then
  useradd --system --gid "${service_group}" --home-dir "${state_dir}" --shell /usr/sbin/nologin "${service_user}"
fi

make -C "${repo_dir}" bootstrap
controller_version=${CONTROLLER_VERSION:-0.9.2-dev}
make -C "${repo_dir}" VERSION="${controller_version}" build

install -d -o root -g root -m 0755 "${environment_dir}" /usr/local/share/agh-ha-controller
install -d -o "${service_user}" -g "${service_group}" -m 0750 "${state_dir}"
install -d -o root -g root -m 0755 "${web_dir}"
install -o root -g root -m 0755 "${repo_dir}/bin/agh-ha-controller" /usr/local/bin/agh-ha-controller
install -o root -g root -m 0755 "${repo_dir}/bin/agh-ha-backup" /usr/local/bin/agh-ha-backup
cp -a "${repo_dir}/web/dist/." "${web_dir}/"
chown -R root:root "${web_dir}"

if [[ ! -f ${environment_file} ]]; then
  database_password=${POSTGRES_PASSWORD:-$(openssl rand -hex 24)}
  session_secret=$(openssl rand -base64 48)
  credential_key=$(openssl rand -base64 32)
  runuser -u postgres -- psql --set=ON_ERROR_STOP=1 \
    --set=db_name="${database_name}" --set=db_user="${database_user}" --set=db_password="${database_password}" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user') \gexec
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name') \gexec
SQL
  umask 077
  {
    printf 'APP_ENV=production\n'
    printf 'INSTALLATION_TYPE=native_systemd\n'
    printf 'HTTP_ADDR=:8080\n'
    printf 'DATABASE_URL=postgres://%s:%s@127.0.0.1:5432/%s?sslmode=disable\n' "${database_user}" "${database_password}" "${database_name}"
    printf 'PUBLIC_BASE_URL=%s\n' "${public_base_url}"
    printf 'SESSION_SECRET=%s\n' "${session_secret}"
    printf 'CREDENTIAL_ENCRYPTION_KEY=%s\n' "${credential_key}"
    printf 'LOG_LEVEL=info\nSESSION_DURATION=12h\nNODE_HEALTH_INTERVAL=30s\nNODE_REQUEST_TIMEOUT=10s\nSTATISTICS_POLL_INTERVAL=1h\nQUERY_LOG_COLLECTION_ENABLED=true\nQUERY_LOG_POLL_INTERVAL=30s\nQUERY_LOG_RETENTION=168h\nAUTO_MIGRATE=true\n'
  } >"${environment_file}"
  chmod 0600 "${environment_file}"
else
  echo "Preserving existing ${environment_file}"
fi

install -o root -g root -m 0644 "${repo_dir}/packaging/systemd/agh-ha-controller.service" /etc/systemd/system/agh-ha-controller.service
systemctl daemon-reload
systemctl enable agh-ha-controller.service
# `enable --now` starts an inactive unit but deliberately leaves an already
# running process untouched. Always restart after replacing the binary and UI
# so an upgrade cannot serve a new frontend against an old API process.
systemctl restart agh-ha-controller.service
systemctl is-active --quiet agh-ha-controller.service
systemctl --no-pager --full status agh-ha-controller.service
echo "Installation complete. Open ${public_base_url} to create the initial administrator."
