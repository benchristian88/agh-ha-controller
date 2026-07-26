# Contributing

AGH HA Controller is at an early architecture stage. Contributions should preserve the product's core operating model rather than optimising prematurely for scale or adding unrelated functionality.

## Before contributing

Read:

- `AGENTS.md`
- `docs/architecture/architecture.md`
- `docs/roadmap/roadmap.md`
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

## Commit guidance

Use concise imperative commit messages.

Examples:

```text
Add node health polling
Create configuration revision schema
Detect node configuration drift
Render cluster convergence status
```
