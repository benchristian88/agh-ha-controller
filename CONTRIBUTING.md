# Contributing

AGH HA Controller is a pre-1.0 management-plane product. Contributions should
preserve its operating and security boundaries rather than adding unrelated
capability or widening support claims without evidence.

## Before contributing

Read:

- `AGENTS.md`
- `docs/architecture/architecture.md`
- `docs/reference/features.md`
- `docs/security/security.md`
- `docs/development/coding-standards.md`
- `docs/development/testing.md`

## Contribution principles

- Start from an operator problem.
- Keep the controller out of the DNS data path.
- Preserve safe failure behaviour.
- Include tests.
- Update documentation.
- Avoid introducing additional infrastructure without a clear need.
- Keep releases incremental and upgradeable.

## Pull requests

A pull request should include:

- Problem statement.
- Proposed behaviour.
- Architecture impact.
- Database or API changes.
- Security considerations.
- Test evidence.
- Documentation changes.
- Screenshots for UI changes.

Do not submit external contributions until the licence and contribution terms
described in ADR-0020 are resolved.

## Commit guidance

Use concise imperative commit messages.

Examples:

```text
Add node health polling
Create configuration revision schema
Detect node configuration drift
Render cluster convergence status
```
