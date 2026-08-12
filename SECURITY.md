# Security Policy

Atlas DNS Controller 1.x is the stable supported release line. Security fixes
are prioritised for the latest 1.x release under the community support policy;
the project does not provide a response-time or remediation SLA.

Do not report vulnerabilities with credentials, session cookies, database
URLs, webhook destinations, backup archives/passphrases, private Query Log data,
or raw AdGuard Home responses in a public issue. Use GitHub's private
**Report a vulnerability** function for this repository. If that function is
unavailable, contact the repository owner privately before sharing reproduction
material.

Include the affected version/commit, deployment type, impact, minimal redacted
reproduction, and whether secrets may have been exposed. Preserve request IDs
and relevant audit/action timestamps without including sensitive payloads.

Deployment controls, trust boundaries, secret handling, backup security, and
incident steps are documented in the [security guide](docs/security/security.md).
