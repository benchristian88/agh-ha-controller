# Coding Standards

## General

- Prefer clarity over cleverness.
- Keep functions focused.
- Make state transitions explicit.
- Avoid global mutable state.
- Use stable terminology from the domain model.
- Document non-obvious failure behaviour.

## Go

- Run `gofmt`.
- Run `go vet`.
- Add static analysis in CI.
- Use table-driven tests where suitable.
- Do not panic for expected runtime failures.
- Avoid logging and returning the same error at every layer.
- Keep transport DTOs separate from domain models.
- Use constructors to enforce invariants.

## TypeScript and React

- Enable strict TypeScript.
- Avoid `any`.
- Use typed API clients.
- Use feature folders.
- Keep server state separate from transient UI state.
- Prefer semantic HTML.
- Include empty and error states.
- Test critical user workflows.

## SQL

- Explicit column lists.
- Foreign keys.
- Check constraints for stable enums where appropriate.
- Index based on real query paths.
- No schema changes outside migrations.

## Documentation

Update documentation when changing:

- Architecture.
- API contracts.
- Database schema.
- Operator workflows.
- Security behaviour.
- Release scope.
