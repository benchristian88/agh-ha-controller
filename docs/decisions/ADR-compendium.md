# AGH HA Controller — Architecture Decision Record Compendium

**Version:** 0.1  
**Date:** 26 July 2026

This file consolidates the individual ADRs. The repository copies under `docs/decisions/` remain the canonical independently versioned records.


---

# ADR-0001: Build a separate controller instead of forking AdGuard Home

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The product needs to add shared configuration, revision history, drift management, aggregated observability, and HA workflows around multiple AdGuard Home nodes. The project could either maintain a fork of AdGuard Home or build an independent controller around unmodified nodes.

## Decision

Build AGH HA Controller as a separate application. Continue to use standard AdGuard Home nodes and integrate through their administration APIs. Do not require a custom AdGuard Home build for the core product.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Existing installations can be onboarded without replacing their DNS software.
- AdGuard Home upgrades remain independently selectable.
- The project avoids inheriting responsibility for maintaining a DNS resolver and filter engine.
- The controller must maintain an explicit compatibility layer and may not be able to manage every feature immediately.

## Alternatives considered

- Fork AdGuard Home and build HA features into its existing backend and UI.
- Create a new DNS server with native clustering.
- Use only external scripts without a persistent controller.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0002: Keep the controller out of the DNS request path

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

DNS is foundational infrastructure. A management controller that becomes necessary for query resolution would introduce a new single point of failure and undermine the reason for running redundant AdGuard Home nodes.

## Decision

DNS clients communicate directly with AdGuard Home nodes. The controller does not proxy, forward, intercept, balance, or otherwise participate in ordinary DNS requests.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- DNS continues during controller or database outages.
- Network architecture remains simple and compatible with existing DHCP, client, VRRP, and load-balancing arrangements.
- The controller cannot directly guarantee traffic distribution or resolver failover; those remain external network responsibilities.
- Availability tests must explicitly prove controller independence.

## Alternatives considered

- Use controller as a DNS reverse proxy or load balancer.
- Embed a shared DNS data plane in the controller.
- Require nodes to query controller for policy on each request.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0003: Use desired-state configuration as the source of truth

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

Simple synchronisation does not establish intent. If two nodes differ, a timestamp or last-writer rule cannot reliably determine which configuration is correct. Safe HA operation needs a durable representation of operator intent.

## Decision

Store a canonical desired configuration in the controller. Derive node-effective configurations from shared state and node overrides. Compare observed node state with desired state and reconcile according to explicit policy.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The controller can explain drift and verify convergence.
- Direct node changes do not automatically become authoritative.
- The data model must distinguish desired, effective, observed, and applied state.
- Import and adoption require explicit operator confirmation.

## Alternatives considered

- Last-writer-wins synchronisation.
- Treat Node A as a permanent primary configuration source.
- Copy files between nodes without a canonical model.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0004: Implement the controller and forwarder in Go

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The project needs an API service, background jobs, network integrations, secure credential handling, and eventually a lightweight node-side forwarder. The reference environment is resource-conscious Debian LXC.

## Decision

Use Go for the controller backend and optional forwarder.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Static binaries simplify installation and upgrades.
- One language can be used across controller and forwarder.
- Go is well suited to networking, concurrency, and low-resource services.
- The team must maintain disciplined domain boundaries to avoid a monolithic package structure.

## Alternatives considered

- Rust for maximum safety and performance.
- Python for faster early scripting.
- Node.js for a shared frontend/backend language.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0005: Use React, TypeScript, and Vite for the frontend

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The controller requires a rich administration interface with dashboard visualisation, structured diffs, long-running deployment progress, complex forms, and responsive state management.

## Decision

Build the frontend with React, strict TypeScript, and Vite.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- A mature ecosystem supports complex administration workflows.
- TypeScript improves API contract safety.
- Vite provides a lightweight development and build pipeline.
- The frontend remains a separate client of the controller API and must not contain business truth.

## Alternatives considered

- Server-rendered Go templates.
- Vue or Svelte.
- Fork the existing AdGuard Home frontend.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0006: Use PostgreSQL as the initial system of record

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The controller needs transactions for revisions and deployments, durable jobs, JSON documents, audit history, and eventually time-series-like query data. The first target remains a small homelab deployment.

## Decision

Use PostgreSQL for control-plane data, statistics snapshots, and initial query-event storage.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- One mature database reduces operational complexity.
- Transactions and constraints protect state changes.
- JSONB supports version-variable configuration documents.
- Time partitioning and rollups can extend the initial design.
- A dedicated analytical database remains possible later if measured scale requires it.

## Alternatives considered

- SQLite for simplest installation.
- ClickHouse from the first release.
- Separate control-plane and time-series databases immediately.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0007: Integrate through a version-aware AdGuard Home API adapter

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

AdGuard Home versions may expose different endpoints, defaults, or payload semantics. Allowing raw API types to spread across the controller would make compatibility and testing fragile.

## Decision

Create a dedicated adapter layer that maps AdGuard Home APIs into stable controller domain models and capability-specific interfaces.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Compatibility behaviour is localised and testable.
- The domain model remains independent from raw endpoint payloads.
- Unsupported fields can be surfaced before mutation.
- Fixtures and contract tests are required for supported versions.

## Alternatives considered

- Call AdGuard Home endpoints directly from services and UI handlers.
- Manage configuration files directly as the normal method.
- Support only one exact AdGuard Home version.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0008: Implement query-log polling before a node forwarder

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

A combined query log is valuable, but a node-side agent adds packaging, security, upgrade, and support complexity. The official API offers an earlier path to validate the user experience.

## Decision

Deliver API-based query-log polling first. Add an optional Go forwarder after the cluster configuration MVP and statistics releases.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The product can demonstrate central search without modifying nodes.
- Polling limitations will be measured with real workloads.
- The forwarder can be designed against evidenced gaps.
- Polling requires cursor, overlap, deduplication, and visible lag.

## Alternatives considered

- Build the forwarder before any query-log UI.
- Read shared network packet captures.
- Do not provide central query logs.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0009: Use sequential verified deployments initially

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

Applying configuration to every node simultaneously increases blast radius and makes partial failure harder to reason about. Early product reliability is more important than deployment speed.

## Decision

Validate all target nodes, then apply and verify one node at a time. Stop or follow an explicit policy when a node fails.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- A bad revision affects fewer nodes before detection.
- Per-node progress and recovery are clearer.
- Deployments take longer as node count grows.
- Parallel and canary strategies can be added later.

## Alternatives considered

- Parallel deployment to all nodes.
- Blind API writes without read-back.
- File synchronisation followed by simultaneous restart.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0010: Separate shared configuration from node-specific overrides

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

HA nodes should share filtering policy but necessarily differ in addresses, interfaces, hostnames, certificates, and sometimes DHCP responsibilities. A single identical document cannot safely represent both realities.

## Decision

Model cluster-shared configuration separately from node-specific managed overrides, then merge them into effective state for each node.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The controller can converge shared policy without overwriting infrastructure identity.
- Diffs and UI must show scope.
- Validation must run against each effective node configuration.
- Override growth must be controlled to avoid turning every node into a unique snowflake.

## Alternatives considered

- Force byte-identical configuration on all nodes.
- Exclude all node-specific values from controller management.
- Maintain a complete unrelated configuration document for every node.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0011: Store immutable configuration revisions and use deployment-based rollback

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

Operators need to know what changed, who changed it, and which configuration was applied. Editing historical records would break auditability and make rollback ambiguous.

## Decision

Publish complete immutable revisions. Rollback by creating a new deployment of a selected historical revision, without editing history.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Revision comparison and audit remain trustworthy.
- Rollback is explicit and itself auditable.
- Storage usage is higher than patch-only history but manageable.
- Schema migration of old revisions must be designed carefully.

## Alternatives considered

- Mutate one current configuration row.
- Store only textual patches.
- Restore node backup files outside the deployment model.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0012: Support Enforce, Alert, and Manual reconciliation policies

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

Different operators and settings have different tolerance for automatic correction. A single always-enforce or never-enforce model would either be unsafe or fail to deliver desired-state value.

## Decision

Provide three initial reconciliation policies: Enforce, Alert, and Manual.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Operators can adopt automation progressively.
- Policy must be visible in drift records and activity.
- Automatic correction still requires verification and audit.
- Section-specific policies may be added later.

## Alternatives considered

- Always overwrite direct changes.
- Only notify and never correct.
- Use last writer as authority.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0013: Start with local authentication and add OIDC later

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The initial homelab product needs a dependable first-run experience without requiring an external identity provider. Advanced users will later expect Authentik, Keycloak, or another OIDC provider.

## Decision

Implement secure local users and sessions first. Add OIDC and richer RBAC after core controller workflows are stable.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Installation is self-contained.
- Authentication is not blocked on SSO design.
- The project must still design user IDs and audit actors so OIDC can be added cleanly.
- Local accounts require secure password storage, rate limiting, and recovery design.

## Alternatives considered

- Require OIDC from the first release.
- Single hard-coded administrator from environment variables.
- No authentication on trusted networks.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0014: Use Debian LXC and systemd as the reference deployment

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The initial target user operates a Proxmox homelab and wants a simple controller LXC alongside two AdGuard Home LXCs. Supporting every packaging model at once would dilute early delivery.

## Decision

Use Debian 13 LXC with systemd as the primary reference. Add Docker Compose and a Proxmox community installer after the application runtime is stable.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The first installation and support path is concrete.
- Static Go binaries fit systemd deployment well.
- Container packaging remains an important but secondary path.
- Documentation and tests must avoid hard-coding one private network or domain.

## Alternatives considered

- Docker-only release.
- Kubernetes-first deployment.
- Install controller inside an AdGuard Home node.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0015: Make central query-log collection privacy-conscious and configurable

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

DNS query history can reveal sensitive browsing and service use. Central aggregation increases usefulness and concentration risk.

## Decision

Treat raw query collection as an explicit, visible feature with configurable retention, secure access, redacted diagnostics, and no external telemetry by default.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Users understand when data is being stored.
- Short retention can be the default.
- Future RBAC must protect query-log access.
- Deletion and retention processes become product features, not background assumptions.

## Alternatives considered

- Collect all query logs indefinitely by default.
- Send anonymised telemetry externally without explicit consent.
- Exclude query-log privacy from the product security model.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0016: Make node management capability-aware and version-aware

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

A controller that assumes every node supports every setting may produce failed or unsafe deployments, particularly across upgrades.

## Decision

Discover and persist node version and capabilities, validate every effective configuration against targets, and surface unsupported behaviour before mutation.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- Mixed-version clusters can be represented honestly.
- The compatibility matrix becomes an explicit release artifact.
- Some features may remain unavailable until all nodes are upgraded.
- Capability discovery and fixtures add ongoing maintenance work.

## Alternatives considered

- Assume API compatibility across versions.
- Require all nodes to run one hard-coded version.
- Attempt writes and infer support only from errors.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0017: Use a monorepo and documentation-first delivery model

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The controller, frontend, forwarder, migrations, packaging, and documentation evolve together. Fragmenting them early would complicate versioning and AI-assisted development.

## Decision

Maintain one repository with Go executables, React frontend, database migrations, packaging, tests, PDD, and ADRs. Require documentation updates for material behaviour changes.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- One release can contain compatible backend, frontend, migrations, and forwarder artifacts.
- Architecture intent stays close to implementation.
- CI must handle multiple toolchains.
- Future independent SDKs may be split only when release independence is valuable.

## Alternatives considered

- Separate repositories immediately.
- Store architecture only in an external wiki.
- Treat documentation as optional after implementation.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0018: Defer controller HA until after the single-controller product is stable

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

Controller HA introduces leader election, shared scheduling, deployment ownership, session behaviour, and database availability concerns. It is not needed to keep DNS available because the controller is outside the data path.

## Decision

Ship and harden a single-controller architecture first. Preserve durable state and process boundaries that allow controller HA later.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The core product remains achievable.
- DNS availability is not compromised by the deferral.
- Management operations are unavailable during controller outage.
- Durable jobs and idempotency remain required to avoid blocking future HA.

## Alternatives considered

- Build active-active controllers from the first release.
- Use embedded consensus immediately.
- Treat controller outage as a DNS outage.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0019: Limit early DHCP support to safe inventory and single-active-node workflows

**Status:** Accepted  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

DHCP HA has different safety and network semantics from DNS HA. Enabling identical DHCP service on multiple nodes can cause conflicts, while ignoring DHCP entirely leaves a visible AdGuard Home feature gap.

## Decision

Initially support DHCP visibility, desired configuration modelling, and guarded single-active-node roles. Defer active-active DHCP coordination until it has a dedicated design.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The controller avoids creating competing DHCP servers.
- Operators can still see and manage limited DHCP state.
- UI and validation must make the active node explicit.
- Full DHCP failover remains out of scope.

## Alternatives considered

- Enable DHCP identically on every node.
- Implement a proprietary DHCP failover protocol immediately.
- Hide DHCP completely even when enabled on nodes.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0020: Defer final licensing selection pending legal and commercial review

**Status:** Proposed  
**Date:** 26 July 2026  
**Decision owners:** Project owner and maintainers  
**Related PDD:** `docs/product/product-design-document.md`

## Context

The intended model combines free homelab use, external contributions, protection against repackaging and resale, and a future supported MSP edition. These goals may not all be compatible with an OSI-approved open-source licence.

## Decision

Do not select or claim a final licence until the product owner has obtained appropriate legal and commercial advice. Keep the repository marked as unlicensed or private during pre-release development.

## Decision drivers

- Preserve the core product value proposition.
- Keep DNS availability independent from management-plane availability.
- Optimise for a reliable two-node homelab experience first.
- Maintain a credible path to broader and commercial use.
- Reduce irreversible implementation coupling.

## Consequences

- The project avoids accidentally granting rights inconsistent with its business intent.
- Public contributions cannot be accepted safely until contribution and licence terms are clear.
- A decision is required before public community release.
- Potential models include permissive/open-core, copyleft, source-available, dual licensing, and contributor agreements.

## Alternatives considered

- Choose a licence based only on familiarity.
- Call the project open source while using incompatible restrictions.
- Accept significant external code before contribution terms are defined.

## Implementation implications

- Code and schema changes that contradict this decision require a superseding ADR.
- Tests should prove the failure behaviour implied by this decision.
- User-facing documentation must reflect the selected model.
- AI coding agents must treat this ADR as a constraint, not a suggestion, while its status is Accepted.

## Review triggers

Review this decision when:

- a documented assumption is disproved by implementation evidence;
- AdGuard Home changes materially;
- the project enters an MSP or enterprise phase;
- scale or support requirements create a clear operational constraint;
- a safer or simpler alternative becomes available.

---

# ADR-0021: Define Release 0.1 runtime and security foundations

**Status:** Accepted

**Date:** 27 July 2026

**Decision owners:** Project owner and maintainers
**Related release:** 0.1

## Context

The product design leaves several implementation choices open before Release 0.1: HTTP routing, PostgreSQL access, migration execution, password and session protection, credential encryption, node TLS trust, health-job persistence, and frontend delivery. The release needs a small, auditable foundation without creating infrastructure that competes with later desired-state and deployment work.

## Decision

Release 0.1 will use:

- Go's standard `net/http` router and middleware model;
- `pgx` for PostgreSQL access without an ORM;
- ordered SQL migrations embedded from the repository-level `migrations` package and tracked in `schema_migrations`;
- Argon2id password hashes with parameters stored in the encoded hash;
- random opaque browser session and CSRF tokens, stored only as HMAC-SHA-256 hashes using the runtime session secret;
- versioned AES-256-GCM envelopes for AdGuard Home credentials, using a runtime key that is never stored in PostgreSQL;
- system trust, an optional node-specific custom CA, or explicit plaintext HTTP for node transport; TLS certificate verification cannot be disabled;
- immediate and interval-based health polling in the controller process, because health checks are idempotent and their durable result is stored on the node record;
- a React/Vite frontend served by the controller from a configured build directory on the same origin as the API.

Release 0.1 supports the AdGuard Home `/control/status` contract for version family `v0.107.x` and later compatible status payloads. Configuration capability discovery remains Release 0.2 scope.

## Consequences

- The controller remains one service and one failure domain for the initial homelab release.
- Domain and adapter boundaries do not depend on a router, ORM, or raw AdGuard Home response type.
- Migration and audit behavior can be tested directly against PostgreSQL.
- Stolen database contents do not directly reveal session tokens or node passwords.
- Loss of runtime secrets invalidates sessions or makes node credentials unrecoverable, so backups must include those secrets separately.
- Plain HTTP node connections are possible only through an explicit, visible policy and are discouraged.
- Health polling resumes safely after restart without a durable job queue; later long-running mutations still require persisted jobs.
- Production packaging must install both the controller binary and the built frontend directory.

## Alternatives considered

- A third-party HTTP router and ORM.
- Database-backed plaintext or reversibly encoded credentials.
- Signed session payloads containing user state.
- Silently skipping TLS certificate verification.
- A durable queue for idempotent health checks.
- A separately hosted frontend or checked-in generated frontend assets.

## Review triggers

Review this decision when health work becomes stateful, API traffic requires multiple controller processes, key rotation is implemented, the supported AdGuard Home version range changes, or packaging requires a single embedded binary.

---

# ADR-0022: Support git-based systemd and Docker Compose installation in 0.1.1

**Status:** Accepted

**Date:** 28 July 2026

**Decision owners:** Project owner and maintainers
**Related release:** 0.1.1

## Context

ADR-0014 selected Debian LXC and systemd as the reference deployment and deferred Docker Compose until the application runtime was stable. Release 0.1 established the combined process, same-origin frontend, PostgreSQL schema, runtime validation, and health endpoints. Operators now need complete installation from a git checkout on Docker-enabled or directly built hosts.

## Decision

Keep Debian 13 LXC/systemd as the reference topology and support two source-based installation paths in 0.1.1: a Debian installer that builds and provisions the service and PostgreSQL, and a production Docker Compose stack that builds a non-root controller image and runs persistent PostgreSQL 17.

Both paths run the same binary, use embedded migrations, serve UI and API on one origin, and keep the controller out of the DNS path.

## Consequences

- Docker installation is delivered earlier than ADR-0014 anticipated.
- Git and a build toolchain or Docker builder are required.
- Runtime secrets must be protected and backed up separately from PostgreSQL.
- Prebuilt signed artifacts, automated rollback, and the Proxmox community installer remain deferred.

## Review triggers

Review when signed artifacts are published, external PostgreSQL becomes a supported Compose topology, or automated upgrade and rollback are introduced.

---

# ADR-0023: Freeze Release 0.2 as a read-only configuration inventory

**Status:** Accepted

**Date:** 2026-07-29

**Related release:** 0.2

Freeze canonical schema version 1 around read-only DNS and filtering inventory. Store immutable observation attempts separately from mutable capability profiles. Explicitly confirmed import creates or replaces one optimistic non-authoritative draft per cluster; it does not publish a revision, claim convergence, deploy, or mutate nodes. Preserve order where AdGuard Home semantics are ordered, normalise set-like fields, and discard known runtime/generated fields at the adapter boundary. Compatibility fixtures cover v0.107.52 and v0.107.61. Full context and consequences are recorded in the standalone ADR-0023.

---

# ADR-0024: Define the Release 0.3 authoritative deployment and reconciliation boundary

**Status:** Accepted

**Date:** 2026-07-30

**Related release:** 0.3

Separate authoritative `DesiredDocument` revisions from per-node observations. Deploy immutable revisions through durable sequential tasks, validate every target before mutation, stop on first failure, verify by semantic read-back, activate only after complete success, and represent rollback as another deployment. Reconciliation uses durable deduplicated drift events and cluster `manual`, `alert`, or `enforce` policy; maintenance always suppresses mutation. Schema-v1 writes only supported DNS/filtering HTTP API fields. Listener differences fail preflight, whitelist filters remain unmanaged, and the controller never edits AdGuard Home files. Full rationale and deferrals are recorded in standalone ADR-0024.

---

# ADR-0025: Version broader configuration and guard DHCP handoffs

**Status:** Accepted

**Date:** 2026-07-30

**Related release:** 0.4

Introduce canonical schema v2 without rewriting immutable schema-v1 records. AdGuard Home v0.107.52 retains schema-v1 inventory and historical reconciliation; schema v2 supports the explicitly reviewed v0.107.53–v0.107.78 range and treats newer contracts as unknown. Project observations to the revision schema and compare only managed fields for convergence. Shared state gains broader DNS, filters/allowlists, clients, rewrites, service/safety, query-log, and statistics policy. DHCP configuration/static leases are node overrides with at most one enabled node and disable-before-enable deployment ordering; dynamic leases and redacted TLS status are observed-only. TLS secrets are never decoded or stored, and TLS mutation remains deferred. Filter refresh is explicit and audited. Full rationale and consequences are recorded in standalone ADR-0025.

---

# ADR-0028: Aggregate exact node statistics in the controller

**Status:** Accepted

**Date:** 2026-08-09

**Related release:** 0.5

Poll exact 24-hour, 7-day, and 30-day AdGuard Home statistics from explicitly
supported v0.107.72–v0.107.78 nodes. Persist normalized immutable snapshots,
small per-node attempt evidence, and overlap-safe node buckets. Sum additive
counters, derive aggregate percentages, weight processing time by queries and
upstream latency by response counts, and expose completeness/freshness beside
all results. Maintenance and unsupported nodes remain explicit. The pipeline
does not proxy DNS, mutate nodes, persist raw responses, or consume query logs.
Full rationale, retention, normalization, and failure behavior are recorded in
standalone ADR-0028.
