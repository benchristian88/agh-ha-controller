# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.24-bookworm AS controller
ARG VERSION=0.9.2-dev
ARG COMMIT=unknown
ARG BUILT_AT=unknown
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN mkdir -p /tmp/go-build && \
    CGO_ENABLED=0 GOCACHE=/tmp/go-build GOTMPDIR=/tmp/go-build go build -p 1 -trimpath \
    -ldflags "-s -w -X github.com/benchristian88/agh-ha-controller/internal/version.Version=${VERSION} -X github.com/benchristian88/agh-ha-controller/internal/version.Commit=${COMMIT} -X github.com/benchristian88/agh-ha-controller/internal/version.BuiltAt=${BUILT_AT}" \
    -o /out/agh-ha-controller ./cmd/controller
RUN CGO_ENABLED=0 GOCACHE=/tmp/go-build GOTMPDIR=/tmp/go-build go build -p 1 -trimpath \
    -ldflags "-s -w -X github.com/benchristian88/agh-ha-controller/internal/version.Version=${VERSION} -X github.com/benchristian88/agh-ha-controller/internal/version.Commit=${COMMIT} -X github.com/benchristian88/agh-ha-controller/internal/version.BuiltAt=${BUILT_AT}" \
    -o /out/agh-ha-backup ./cmd/agh-ha-backup

FROM postgres:17-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 aghha \
    && useradd --system --uid 10001 --gid aghha --home-dir /var/lib/agh-ha-controller aghha \
    && install -d -o 10001 -g 10001 -m 0700 /var/lib/agh-ha-controller/tmp
COPY --from=controller /out/agh-ha-controller /usr/local/bin/agh-ha-controller
COPY --from=controller /out/agh-ha-backup /usr/local/bin/agh-ha-backup
COPY --from=web /src/web/dist /usr/local/share/agh-ha-controller/web
USER 10001:10001
EXPOSE 8080
ENV APP_ENV=production HTTP_ADDR=:8080 WEB_DIST_DIR=/usr/local/share/agh-ha-controller/web AUTO_MIGRATE=true TMPDIR=/var/lib/agh-ha-controller/tmp
ENTRYPOINT ["/usr/local/bin/agh-ha-controller"]
