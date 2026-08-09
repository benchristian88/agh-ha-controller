#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
release_version=${CONTROLLER_VERSION:?set CONTROLLER_VERSION, for example 0.9.0}
case ${release_version} in
  *[!0-9A-Za-z.+-]*|'') echo "CONTROLLER_VERSION contains unsupported characters" >&2; exit 1 ;;
esac
release_commit=$(git -C "${repo_dir}" rev-parse --short=12 HEAD)
release_built_at=${CONTROLLER_BUILT_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}
release_dir="${repo_dir}/dist/release/${release_version}"
mkdir -p "${release_dir}"

make -C "${repo_dir}" VERSION="${release_version}" COMMIT="${release_commit}" BUILT_AT="${release_built_at}" build

ldflags="-s -w -X github.com/benchristian88/agh-ha-controller/internal/version.Version=${release_version} -X github.com/benchristian88/agh-ha-controller/internal/version.Commit=${release_commit} -X github.com/benchristian88/agh-ha-controller/internal/version.BuiltAt=${release_built_at}"
for architecture in amd64 arm64; do
  for command_name in controller agh-ha-backup migrate; do
    package_name=${command_name}
    output_name=${command_name}
    if [[ ${command_name} == controller ]]; then output_name=agh-ha-controller; fi
    if [[ ${command_name} == migrate ]]; then output_name=agh-ha-migrate; fi
    CGO_ENABLED=0 GOOS=linux GOARCH="${architecture}" go build -trimpath -ldflags "${ldflags}" -o "${release_dir}/${output_name}-linux-${architecture}" "./cmd/${package_name}"
  done
done

tar -C "${repo_dir}/web/dist" -czf "${release_dir}/agh-ha-controller-web-${release_version}.tar.gz" .
(
  cd "${release_dir}"
  shasum -a 256 agh-ha-* > SHA256SUMS
)

if command -v syft >/dev/null 2>&1; then
  syft dir:"${repo_dir}" -o spdx-json="${release_dir}/sbom.spdx.json"
fi

echo "Release artifacts written to ${release_dir}"
