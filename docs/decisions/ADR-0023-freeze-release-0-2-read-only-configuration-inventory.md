# ADR-0023: Freeze Release 0.2 as a read-only configuration inventory

**Status:** Accepted

**Date:** 2026-07-29

**Related release:** 0.2

## Context

Release 0.2 must compare existing nodes without crossing the Release 0.3 boundary where the controller becomes authoritative and can deploy revisions. Earlier illustrative documentation described import as also creating Revision 1, which conflicts with that milestone split. Raw AdGuard Home payloads also contain volatile and version-specific fields that cannot be durable domain state.

## Decision

Freeze canonical schema version 1 as a read-only inventory of two supported feature areas: DNS resolver settings and filtering settings. Shared managed fields, node-specific managed fields, observed-only values, and unsupported areas are explicit. Ordered values (upstreams, fallbacks, and custom rules) retain order; set-like values (bootstrap resolvers, private reverse resolvers, bind hosts, and filter URLs) are trimmed, deduplicated, and sorted. Runtime counters, generated filter IDs, display names, rule counts, and timestamps never enter the canonical document.

Store immutable observation attempts separately from the latest per-node capability profile. A failed collection is durable but has no document or hash. Import requires explicit confirmation and creates or replaces one optimistic mutable `configuration_drafts` row per cluster. It does not create or activate a revision, claim convergence, deploy configuration, or mutate a node. Revision publication remains Release 0.3.

Compatibility is verified through committed raw contract fixtures for AdGuard Home v0.107.52 and v0.107.61. The adapter reads only `GET /control/dns_info` and `GET /control/filtering/status` in this release.

## Consequences

- Nodes remain safe to add and inspect; all new AdGuard Home calls are GET requests.
- Semantic equality is deterministic and false drift from known volatile fields is suppressed.
- Schema v1 deliberately does not inventory TLS, DHCP, services, clients, rewrites, or other Release 0.4 areas; the UI reports these as unsupported.
- An imported draft is useful as the starting workspace for Release 0.3 but is not authoritative state.
