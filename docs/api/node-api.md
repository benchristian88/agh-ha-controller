# AdGuard Home Node API Adapter

## Purpose

Define the internal contract between AGH HA Controller and AdGuard Home.

## Adapter responsibilities

- Authenticate.
- Detect version.
- Detect capabilities.
- Fetch status.
- Fetch configuration sections.
- Apply configuration sections.
- Fetch statistics.
- Fetch query log.
- Map raw errors.
- Redact sensitive data.

## Internal interface concept

```go
type Client interface {
    Status(ctx context.Context) (Status, error)
    Capabilities(ctx context.Context) (Capabilities, error)
    ReadConfiguration(ctx context.Context) (ObservedConfiguration, error)
    ApplyConfiguration(ctx context.Context, EffectiveConfiguration) error
    Statistics(ctx context.Context, window TimeWindow) (Statistics, error)
    QueryLog(ctx context.Context, cursor Cursor) (QueryPage, error)
}
```

The final interface may be split into smaller capability-specific interfaces.

## Compatibility

Each API operation must declare:

- Minimum tested AdGuard Home version.
- Known incompatible versions.
- Required capability flags.
- Expected restart behaviour.
- Secret handling requirements.
