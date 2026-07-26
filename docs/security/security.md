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

## Node credentials

- Encrypt at rest.
- Decrypt only when required.
- Never return through API responses.
- Never include in logs.
- Support rotation.
- Prefer a dedicated AdGuard Home administrative account when supported.

## Transport security

- Use HTTPS between browser and controller.
- Use HTTPS between controller and nodes.
- Support trusted CA validation.
- Consider certificate pinning for homelab nodes.
- Do not default to silently ignoring invalid certificates.

## Browser security

- CSRF protection.
- Content Security Policy.
- Secure cookies.
- SameSite cookie policy.
- Output encoding.
- No secrets in browser storage.
- No sensitive data in URLs.

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
