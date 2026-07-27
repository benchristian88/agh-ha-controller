# Tests

- `integration/`: PostgreSQL, API, migration, encryption, audit, and two-node workflow.
- `support/aghstub/`: authenticated AdGuard Home Release 0.1 status-contract simulator.
- `e2e/`: reserved for browser-driven critical workflows.

From a clean checkout, run the non-skipping Release 0.1 suite with:

```bash
make bootstrap
make test-local
make test-env-down
```

Run `make test-integration` for only the PostgreSQL/API workflow or `make test-local-race` for the complete Go race suite. The Compose environment is defined in `compose.test.yml`; its exact addresses and credentials are documented in the repository README.

Direct `go test ./...` remains useful for fast development: it uses in-process node servers and skips the PostgreSQL workflow when `TEST_DATABASE_URL` is absent. It is not the complete local release command.
