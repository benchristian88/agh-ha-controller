# Release 0.4.1 Phase 8B Implementation Record

## Operator outcome

`/settings/dhcp` provides two separate destructive operations for one selected
node: reset dynamic DHCP leases and reset node-local DHCP configuration. Each
uses `OperationalCommandDialog`, names the exact node and current cluster,
explains consequences and recoverability, and requires a typed confirmation.
The dialog explicitly distinguishes the immediate command from Save Draft,
Publish, and Deploy.

## Architecture and safety boundary

The browser calls only authenticated, CSRF-protected controller routes. The
controller requires an enabled node in maintenance mode, rejects commands
during an active cluster deployment, and calls exactly one matching AdGuard
Home endpoint. Configuration reset additionally requires Manual or Alert
reconciliation. There is no fleet DHCP reset route or multi-node request body.

Maintenance is required so reconciliation cannot mutate the target before the
operator inspects the outcome. Configuration reset also rejects Enforce so the
later managed mismatch retains an explicit restore/adopt choice. Lease reset is
observed-only and does not require a reconciliation-policy change. This explicit
command is the only mutation being authorised; maintenance continues to
suppress automatic deployments and reconciliation.

Reset operations never update a draft, publish a revision, start a deployment,
change the designated DHCP node, or alter the one-active-node and
disable-before-enable rules.

## Durable result and duplicate protection

Migration `000005_release_0_4_1_dhcp_operations` stores operational commands and
their node results outside configuration revisions and deployments. Results
contain stable status/error codes, request ID, terminal audit reference,
observation outcome, and timestamps. The UI loads the latest records from the
controller, so completion and failure remain visible after navigation or page
reload.

Each POST requires a UUID `Idempotency-Key`. The database uniqueness boundary is
the requesting user and key. A repeated terminal request returns the original
result without another node call; an in-progress duplicate is rejected.

## Audit and redaction

Each accepted command writes a requested event followed by exactly one
succeeded or failed event. Metadata includes only cluster ID, node ID, command,
operation ID, stable status/error codes, and safe observation identifiers. Node
URLs, credentials, request payloads, upstream response bodies, and raw transport
errors are excluded from the durable result, audit metadata, and API response.

## Observation and drift

After an upstream success, the controller immediately performs a normal durable
observation. Dynamic leases are observed-only and remain excluded from managed
drift. Resetting DHCP configuration leaves desired state unchanged, so the fresh
observation exposes a managed mismatch. After maintenance is cleared, Manual or
Alert drift evaluation records the mismatch without automatic mutation and the
existing restore/adopt workflow remains authoritative.

An observation failure is recorded separately and does not misreport a
successful destructive upstream command as failed.

## Tests

Coverage includes exact no-body AdGuard methods and paths, success, rejection,
timeout/unreachable mapping, response redaction, authentication, CSRF, explicit
node scope, confirmation tokens, maintenance and active-deployment guards,
durable success/failure, idempotency, audit contents, observation refresh,
desired-state immutability, lease/config drift behavior, typed confirmation,
keyboard dismissal/focus behavior, double-submit suppression, result display,
and absence of a fleet reset route.
