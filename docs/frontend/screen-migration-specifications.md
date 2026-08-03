# Screen Migration Specifications

> **Completed migration specification.** Retained to explain the Release 0.4.1
> implementation choices. Use the Phase 10 regression report and current
> route/feature documentation for live status.

## Configuration Control

### Preserve

- observations;
- import/adopt;
- validation;
- publish;
- links to immutable history and deployment.

### Remove

- stale schema-v1 wording;
- duplicate narrow DNS/filter editor.

### Add

- complete schema-v2 draft summary;
- links to authoring pages;
- active revision;
- changed sections;
- capability summary;
- affected nodes;
- publication readiness;
- observation/import as an advanced workflow.

## HA Controller responsibility reconciliation — 3 August 2026

- Change History owns immutable revision list/detail, revision comparison, and
  deployment of a historical immutable revision.
- Deployments owns active/history/detail execution presentation and per-node
  verification results.
- Drift owns current convergence summaries, semantic incident comparison,
  reconciliation policy, restore, adoption, and maintenance.
- Nodes owns infrastructure health, compatibility, observation, applied
  revision, latency, and drift indicators.
- Configuration Control remains forward-looking and no longer embeds the
  revision-history or rollback workflow.

## Blocked Services

Create `/filters/blocked-services`.

Sections:

1. Search and group filter.
2. Selected count and scope.
3. Grouped service catalogue.
4. Inactivity schedule.
5. Capability and compatibility warnings.
6. Draft state and Save Draft action.

## DNS Blocklists and Allowlists

Separate pages.

Table columns:

- enabled;
- name;
- URL;
- rule count;
- last update;
- node application state;
- actions.

Actions:

- add;
- edit;
- disable/remove;
- refresh selected;
- refresh all.

## Clients

Table columns:

- name;
- identifiers;
- tags;
- inheritance;
- services;
- node compatibility;
- actions.

Dialog sections:

- identity;
- identifiers;
- tags;
- inherited/global policy;
- safety;
- logging/statistics;
- blocked services;
- upstreams;
- cache.

## DNS Rewrites

Table columns:

- domain;
- answer;
- type;
- revision state;
- node convergence;
- actions.

## DHCP

Node-specific page or scope.

Sections:

- designated active node;
- interface;
- active-DHCP preflight;
- IPv4;
- IPv6 where supported;
- active leases;
- static leases;
- destructive reset actions.

## General and DNS settings

Migrate to shared SettingRow/SettingsGroup patterns.

Replace raw numeric fields where appropriate:

- retention → duration;
- TTL → duration;
- timeout → duration;
- cache bytes → human-readable size;
- IP/CIDR textareas → network list;
- ignored domains → structured list.

## Deferred screens

Statistics and Query Log should receive explicit planned/not-implemented states or be omitted until their release. They must not resolve to Dashboard by accident.

## Setup Guide

Do not silently treat this as complete.

Create a product decision for:

- both-node DNS addresses;
- router configuration;
- client configuration;
- encrypted DNS endpoints;
- controller outage test;
- node failure test;
- Apple profile download support.
