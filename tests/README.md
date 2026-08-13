# Tests

- `integration/release_0_1_test.go`: PostgreSQL migration and Release 0.1/0.1.1 API workflow.
- `integration/release_0_3_test.go`: authoritative two-node deployment, read-back verification, enforce-mode drift restoration, and rollback workflow.
- `integration/release_0_4_1_test.go`: durable DHCP, DNS, host-filter, Query Log,
  and Statistics operational-command persistence, attribution, idempotency,
  and desired-state isolation.

Run unit and frontend tests with `make test`. Run the database workflow against an explicitly supplied empty PostgreSQL database:

```bash
TEST_DATABASE_URL='postgres://user:password@127.0.0.1:5432/atlas_dns_test?sslmode=disable' make test-integration
```

The test creates an isolated schema and uses in-process HTTP servers for the two AdGuard Home status endpoints. Optional `TEST_NODE_A_URL` and `TEST_NODE_B_URL` values can target external compatible nodes.
