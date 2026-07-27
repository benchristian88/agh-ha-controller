.PHONY: bootstrap fmt fmt-check test test-race test-env-up test-env-down test-env-clean test-env-reset test-integration test-local test-local-race lint dev build migrate migrate-down clean

GO ?= go
NPM ?= npm
COMPOSE ?= docker compose
TEST_COMPOSE_FILE ?= compose.test.yml
LOCAL_TEST_DATABASE_URL ?= postgres://aghha:aghha-local-test@127.0.0.1:55432/aghha?sslmode=disable
LOCAL_TEST_NODE_A_URL ?= http://127.0.0.1:3101
LOCAL_TEST_NODE_B_URL ?= http://127.0.0.1:3102
LOCAL_TEST_NODE_USERNAME ?= agh-admin
LOCAL_TEST_NODE_PASSWORD ?= node-secret-value
GO_FILES := $(shell rg --files -g '*.go')
VERSION ?= 0.1.0-dev
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

test-env-up:
	$(COMPOSE) -f $(TEST_COMPOSE_FILE) up --build --detach --wait

test-env-down:
	$(COMPOSE) -f $(TEST_COMPOSE_FILE) down --remove-orphans

test-env-clean:
	$(COMPOSE) -f $(TEST_COMPOSE_FILE) down --volumes --remove-orphans

test-env-reset:
	$(COMPOSE) -f $(TEST_COMPOSE_FILE) down --volumes --remove-orphans
	$(COMPOSE) -f $(TEST_COMPOSE_FILE) up --build --detach --wait

test-integration: test-env-up
	TEST_DATABASE_URL='$(LOCAL_TEST_DATABASE_URL)' TEST_NODE_A_URL='$(LOCAL_TEST_NODE_A_URL)' TEST_NODE_B_URL='$(LOCAL_TEST_NODE_B_URL)' TEST_NODE_USERNAME='$(LOCAL_TEST_NODE_USERNAME)' TEST_NODE_PASSWORD='$(LOCAL_TEST_NODE_PASSWORD)' $(GO) test -count=1 ./tests/integration

test-local: test-env-up
	TEST_DATABASE_URL='$(LOCAL_TEST_DATABASE_URL)' TEST_NODE_A_URL='$(LOCAL_TEST_NODE_A_URL)' TEST_NODE_B_URL='$(LOCAL_TEST_NODE_B_URL)' TEST_NODE_USERNAME='$(LOCAL_TEST_NODE_USERNAME)' TEST_NODE_PASSWORD='$(LOCAL_TEST_NODE_PASSWORD)' $(GO) test -count=1 ./...
	cd web && $(NPM) test

test-local-race: test-env-up
	TEST_DATABASE_URL='$(LOCAL_TEST_DATABASE_URL)' TEST_NODE_A_URL='$(LOCAL_TEST_NODE_A_URL)' TEST_NODE_B_URL='$(LOCAL_TEST_NODE_B_URL)' TEST_NODE_USERNAME='$(LOCAL_TEST_NODE_USERNAME)' TEST_NODE_PASSWORD='$(LOCAL_TEST_NODE_PASSWORD)' $(GO) test -race -count=1 ./...

lint:
	$(GO) vet ./...
	cd web && $(NPM) run lint

dev:
	$(GO) run ./cmd/controller

build:
	mkdir -p bin
	$(GO) build -trimpath -ldflags "$(LDFLAGS)" -o bin/agh-ha-controller ./cmd/controller
	$(GO) build -trimpath -ldflags "$(LDFLAGS)" -o bin/agh-ha-migrate ./cmd/migrate
	cd web && $(NPM) run build

migrate:
	$(GO) run ./cmd/migrate -direction up

migrate-down:
	$(GO) run ./cmd/migrate -direction down

clean:
	$(GO) clean
