# Screen Migration Specifications

## Configuration Control

### Preserve

- observations;
- import/adopt;
- validation;
- immutable revisions;
- compare;
- publish;
- deploy;
- rollback.

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
