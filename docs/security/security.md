# Security Model

## Security goals

- Protect AdGuard Home administrative credentials.
- Prevent unauthorised configuration changes.
- Preserve auditability.
- Avoid exposing DNS query history.
- Keep DNS serving independent from controller compromise or outage.
- Limit controller privileges on nodes.

## Authentication

Initial release:

- Local users.
- Strong password hashing.
- Secure HTTP-only session cookies.
- Session expiry and revocation.
- Login rate limiting.

Future:

- OIDC.
- Authentik.
- Role-based access control.
- API tokens.

### Release 0.1 implementation

- Passwords use Argon2id with the salt and cost parameters encoded in each hash.
- Setup is serialized and can create only the first local administrator.
- Successful authentication creates a random opaque session token and a separate random CSRF token.
- PostgreSQL stores only purpose-separated HMAC-SHA-256 token hashes using the base64-decoded `SESSION_SECRET` (at least 32 bytes).
- Session cookies are HTTP-only and SameSite=Strict; both session and CSRF cookies are Secure when the public URL is HTTPS.
- Unsafe authenticated requests require the CSRF cookie value in `X-CSRF-Token` and verify it against the stored hash.
- Login failures use a dummy password hash for unknown users, return a generic message, are rate-limited in process, and create redacted audit events.
- Session expiry/revocation is enforced on every authenticated request; expired rows are cleaned in the background.

The 0.1 login limiter resets on controller restart. Durable distributed throttling is deferred until multiple controller processes are supported.

Release 0.1.1 installation keeps these boundaries unchanged. The Docker controller runs as a fixed non-root user with a read-only root filesystem and no-new-privileges. The systemd unit uses an unprivileged service account, filesystem protections, and a root-only environment file. Docker `.env` and systemd runtime environment files contain recovery-critical secrets and must never be committed, logged, or copied into diagnostics.

### Release 0.3 mutation controls

- Every draft, publication, deployment, rollback, cancellation, drift action, reconciliation result, maintenance change, and reconciliation-policy change is authenticated and audited; browser mutations retain same-origin CSRF enforcement.
- Decrypted node credentials exist only for the bounded outbound request and are never placed in deployment errors, drift documents, API payloads, or audit metadata.
- Deployment validation checks every target before the first mutation. Only supported AdGuard Home HTTP APIs are used; the controller does not receive filesystem or DNS-process privileges on a node.
- API errors store stable codes and safe messages. Detailed transport failures remain in structured controller logs without request bodies or credentials.
- Maintenance suppresses automatic mutation, and Enforce is an explicit cluster policy rather than an implicit default.

### Release 0.4 secret and infrastructure controls

- The TLS adapter decodes only public status and certificate metadata. Certificate chains, private keys, `private_key_saved`, and certificate/key filesystem paths have no domain fields and cannot enter snapshots, revisions, API payloads, browser state, audits, or diagnostics.
- TLS mutation is explicitly unsupported until a separate controller secret-reference design exists.
- DHCP settings and static leases are node-specific desired state. Validation permits only one enabled node, and role handoff disables other managed nodes before enabling the selected node.
- Rejected AdGuard configuration mutations expose only a fixed HTTP method/path and numeric response status in the per-node deployment diagnostic. Node response bodies, request payloads, credentials, base URLs, and authorities are not stored or displayed.
- Filter refresh requires an authenticated CSRF-protected request and an enabled node outside maintenance. Requested and succeeded/failed audit events contain only node identity, list type, and a stable error code.
- DNS upstream-test and cache-clear commands require authentication, CSRF, explicit scope, and per-user idempotency. Resolver input is AES-256-GCM encrypted while queued and removed on completion; audit metadata contains only an input fingerprint, target counts, and stable error codes. Raw resolver strings, credentials, node URLs, and node response bodies are excluded.
- Destructive DHCP lease/configuration resets require authenticated CSRF-protected node-only routes, typed confirmation, an enabled maintenance node, no active cluster deployment, and a per-user UUID idempotency key. Configuration reset additionally rejects Enforce reconciliation so its managed mismatch retains an explicit restore/adopt choice; lease reset changes only observed data. Durable results and requested/terminal audits contain only stable IDs/status/error codes; raw upstream bodies, node URLs, and credentials are discarded.
- Query-log/statistics policy does not ingest DNS activity into PostgreSQL in 0.4; it only changes node-local retention, ignore, enablement, and anonymization settings.

## Node credentials

- Encrypt at rest.
- Decrypt only when required.
- Never return through API responses.
- Never include in logs.
- Support rotation.
- Prefer a dedicated AdGuard Home administrative account when supported.

Release 0.1 encrypts a JSON credential payload with AES-256-GCM, authenticates the node UUID as additional data, and records the algorithm and key version. The runtime key must decode to exactly 32 bytes and is never stored in PostgreSQL. API response types contain no credential or envelope fields. Node removal destroys its stored ciphertext, nonce, and custom CA after exact-name confirmation and optimistic-concurrency validation.

## Transport security

- Use HTTPS between browser and controller.
- Use HTTPS between controller and nodes.
- Support trusted CA validation.
- Consider certificate pinning for homelab nodes.
- Do not default to silently ignoring invalid certificates.

Node policy is explicitly `system`, `custom_ca`, or `insecure_http`. There is no skip-verification mode. The adapter connects directly rather than inheriting HTTP proxy settings, caps bodies, rejects redirects, and separates TLS, authentication, reachability, and invalid-response failures.

## Browser security

- CSRF protection.
- Content Security Policy.
- Secure cookies.
- SameSite cookie policy.
- Output encoding.
- No secrets in browser storage.
- No sensitive data in URLs.

The same-origin server emits a restrictive Content Security Policy, frame denial, no-sniff, no-referrer, permissions restrictions, and `Cache-Control: no-store` on API responses. The frontend keeps credentials only in transient form state and never puts them in URLs or persistent browser storage.

Release 0.2 configuration collection reuses decrypted node credentials only inside the service/adapter call and performs GET requests only. Raw node payloads are not logged or stored. Canonical documents exclude credentials and known secret material; failed observations retain only stable safe error codes.

## Audit events

Audit:

- Login success and failure.
- User changes.
- Node onboarding and removal.
- Credential rotation.
- Configuration revision creation.
- Deployment.
- Rollback.
- Drift adoption.
- Drift correction.
- Retention changes.
- Diagnostic export.

## Query-log privacy

Query logs can expose personal behaviour.

The UI must clearly show:

- Whether central query logging is enabled.
- Retention period.
- Who can access it.
- Whether raw events or aggregates are stored.

Release 0.6 exposes normalized raw events only through authenticated,
cluster-scoped controller APIs and the same-origin UI. The controller preserves
node anonymisation exactly as received and does not attempt reversal. Event
rows exclude administrative credentials, node URLs, full source payloads, and
unrelated configuration. Routine logs include node IDs, safe status/error codes,
and inserted counts—not query names, clients, answers, credentials, or response
bodies. Search is length-validated and parameterized.

The single local administrator role is the current authorization boundary;
fine-grained Query Log RBAC remains later scope and must be introduced before
multi-role access. Existing Query Log clear commands remain separately
confirmed, CSRF-protected, durable, and audited. Retention cleanup is not a
node-clear operation. Query events remain excluded from normal diagnostic and
support bundles unless a future explicit redacted export is designed.

## Release 0.7 operational diagnostics

Detailed `/api/v1/clusters/{clusterId}/operational-status` data requires the
existing authenticated administrator session and cluster validation. It
contains stable safe codes and aggregate metadata, never raw worker errors,
stack traces, node URLs, credentials, query contents, or client identifiers.

`/health` and `/ready` remain intentionally minimal and unauthenticated for
orchestrator checks. `/metrics` returns 404 unless an operator configures a
minimum-32-character `METRICS_BEARER_TOKEN`; enabled scrapes require that bearer
token and should also be limited by host firewall or reverse-proxy policy. The
token is runtime-secret material and is never logged or returned.

ADR-0029 keeps AGH HA Controller agentless by default. Release 0.7 adds no node daemon,
machine credential, remote-shell privilege, or local DNS-host spool.

## Threats to consider

- Compromised controller.
- Compromised AdGuard Home node.
- Stolen database.
- Leaked encryption key.
- Malicious configuration revision.
- Session theft.
- CSRF.
- Log injection.
- Query-log exfiltration.
- Dependency compromise.
- Unsafe diagnostic bundles.

## Secret recovery

Loss of the encryption key means encrypted node credentials cannot be recovered.

Legacy PostgreSQL-only backups require the key to be stored separately and
securely. Release 0.9 portable backups include it only inside the
passphrase-encrypted authenticated payload; target runtime configuration and
the archive passphrase remain separate recovery material.

## Release 0.8 lifecycle and notification security

DNS probes contain only an operator-selected test name/type and expected RCODE;
results persist protocol state, latency, family, safe code, and time—not answer
data or client traffic. Loopback/unspecified implicit targets are rejected.
Maintenance, settings, channel, and upgrade mutations are authenticated,
CSRF-protected, optimistic where state is mutable, and audited. Break-glass is
an exact deliberate phrase, and active DHCP ownership blocks maintenance.

Webhook destinations are HTTPS-only, AES-256-GCM encrypted with the existing
external key boundary, and write-only. Delivery payloads and logs omit the
destination, credentials, raw node errors, query data, and certificate/key
material. Retry is bounded and disabled channels are not claimed. Guided
upgrades execute no remote command and failed checks keep the node isolated.

## Release 0.9 administration, backup, and update security

User Administration remains administrator-only on the server. Accounts are
never hard-deleted; disabling immediately fails authentication and revokes all
active sessions. Credential reset replaces the Argon2id hash and revokes every
session for the target. The current operator cannot self-disable, and a locked
transaction prevents disabling the final enabled administrator. Audits contain
actor, target, role/status result, and session-revocation fact—never passwords,
hashes, or tokens.

Portable backups follow ADR-0031. `age` owns passphrase KDF and authenticated
encryption. Outer metadata is non-secret and is checked against the encrypted
manifest. Fixed entry names, regular-file-only extraction, size/entry bounds,
checksums, restrictive temporary permissions, administrator/CSRF authorization,
and empty-target offline restore prevent traversal, bombs, arbitrary overwrite,
and ambiguous live replacement. Restore authority is operating-system access to
the stopped controller, protected passphrase/database-URL files, new database,
and key-output location; no browser restore mutation exists. `pg_restore` uses one transaction
and removes the newly written key if database restore fails. Sessions are
deliberately excluded.

Controller release metadata is bounded, cached, stable-only, and accepts links
only beneath the project GitHub Releases path. The update API returns guidance
as data; it cannot execute a command, access a container socket, restart a
service, choose an arbitrary URL, or install an artifact.
