.PHONY: bootstrap fmt fmt-check test test-race test-integration lint dev build release-artifacts migrate migrate-down compose-config compose-build clean

GO ?= go
NPM ?= npm
COMPOSE ?= docker compose
GO_FILES := $(shell find . -type f -name '*.go' -not -path './web/node_modules/*')
VERSION ?= 0.9.0-dev
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || printf unknown)
BUILT_AT ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS := -X github.com/benchristian88/agh-ha-controller/internal/version.Version=$(VERSION) -X github.com/benchristian88/agh-ha-controller/internal/version.Commit=$(COMMIT) -X github.com/benchristian88/agh-ha-controller/internal/version.BuiltAt=$(BUILT_AT)

bootstrap:
	$(GO) mod download
	cd web && $(NPM) ci

fmt:
	$(GO)fmt -w $(GO_FILES)
	cd web && $(NPM) exec -- biome format --write src

fmt-check:
	@test -z "$$($(GO)fmt -l $(GO_FILES))" || { echo "Go files require gofmt"; $(GO)fmt -l $(GO_FILES); exit 1; }
	cd web && $(NPM) exec -- biome format src

test:
	$(GO) test ./...
	cd web && $(NPM) test

test-race:
	$(GO) test -race ./...

test-integration:
	@test -n "$(TEST_DATABASE_URL)" || { echo "TEST_DATABASE_URL is required"; exit 1; }
	$(GO) test -count=1 ./tests/integration

lint:
	$(GO) vet ./...
	cd web && $(NPM) run lint

dev:
	$(GO) run ./cmd/controller

build:
	mkdir -p bin
	$(GO) build -trimpath -ldflags "$(LDFLAGS)" -o bin/agh-ha-controller ./cmd/controller
	$(GO) build -trimpath -ldflags "$(LDFLAGS)" -o bin/agh-ha-migrate ./cmd/migrate
	$(GO) build -trimpath -ldflags "$(LDFLAGS)" -o bin/agh-ha-backup ./cmd/agh-ha-backup
	cd web && $(NPM) run build

release-artifacts:
	@test -n "$(CONTROLLER_VERSION)" || { echo "CONTROLLER_VERSION is required"; exit 1; }
	CONTROLLER_VERSION="$(CONTROLLER_VERSION)" ./scripts/release-artifacts.sh

migrate:
	$(GO) run ./cmd/migrate -direction up

migrate-down:
	$(GO) run ./cmd/migrate -direction down

compose-config:
	$(COMPOSE) config --quiet

compose-build:
	$(COMPOSE) build

clean:
	$(GO) clean
