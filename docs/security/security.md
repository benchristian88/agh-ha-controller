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

Backups must include the key, stored separately and securely.
