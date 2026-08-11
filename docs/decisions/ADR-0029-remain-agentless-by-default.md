# ADR-0029: Remain agentless by default

## Status

Accepted.

## Context

Release 0.5 proved exact Statistics collection through supported AdGuard Home
APIs. Release 0.6 proved bounded, restart-safe Query Log polling with explicit
freshness and gap evidence. The earlier roadmap reserved Release 0.7 for a
node-local log forwarder, including enrolment, machine credentials, spooling,
packaging, and lifecycle management. That would add a privileged component to
every DNS host without evidence that the working API path is inadequate.

## Decision

AGH HA Controller is agentless by default. Native platform APIs are the standard
integration whenever they provide reliable, supportable behavior:

```text
Statistics: AdGuard API -> controller collector -> PostgreSQL -> API -> UI
Query Log:  AdGuard API -> controller collector -> normalized event -> PostgreSQL -> API -> UI
```

Release 0.7 therefore delivers operational hardening and observability and
does not deliver a forwarder, enrolment, machine credentials, local spool, or
agent lifecycle. ADR-0008 remains valid for the implemented polling design.
ADR-0004's Go language choice applies only if a future evidence-backed
forwarder is approved; it is not a commitment to build one.

An optional local Query Log forwarder is a conditional capability with no
assigned release. Reconsider it only when measurements demonstrate one or more
of: sustained ingestion lag, material event loss between polling windows,
unacceptable node API load, a near-real-time requirement, much larger fleets,
a platform without an adequate query-log API, or required buffering during
long controller outages.

## Consequences

- DNS nodes need no controller runtime, machine credential, or spool directory.
- Collector health, gaps, lag, storage, and retention become the immediate
  reliability boundary and are visible through Release 0.7 status surfaces.
- API limitations remain explicit rather than hidden by optimistic fidelity
  claims.
- A future forwarder requires a new product and security review supported by
  operational evidence.
