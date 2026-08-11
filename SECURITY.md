# Security Policy

AGH HA Controller is pre-1.0 and does not yet publish a production support or
security-fix SLA.

Do not report vulnerabilities with credentials, session cookies, database
URLs, webhook destinations, backup archives/passphrases, private Query Log data,
or raw AdGuard Home responses in a public issue. Use the repository's private
security-advisory channel when it is enabled. If no private channel is available,
contact the repository owner privately before sharing reproduction material.

Include the affected version/commit, deployment type, impact, minimal redacted
reproduction, and whether secrets may have been exposed. Preserve request IDs
and relevant audit/action timestamps without including sensitive payloads.

Deployment controls, trust boundaries, secret handling, backup security, and
incident steps are documented in the [security guide](docs/security/security.md).
