# Release 0.4.1 — Frontend Product Alignment Roadmap

## Goal

Align the Release 0.4 frontend with the AdGuard Home operator model without breaking the desired-state control plane.

## Branch strategy

Create one integration branch:

```text
feature/release-0.4.1-ui-alignment
```

Use short-lived child branches or sequential commits per phase.

Do not combine all phases into one Codex task or one commit.

## Phase 0 — Baseline and routing safety

### Deliverables

- screenshot baseline;
- test baseline;
- route inventory;
- explicit Not Found page;
- old-to-new redirect table;
- no Dashboard fallback for unknown routes.

### Exit gate

All existing critical workflows still pass.

## Phase 1 — Configuration Control reconciliation

### Deliverables

- rename Configuration to Configuration Control;
- remove schema-v1 copy;
- remove duplicate narrow editor;
- complete schema-v2 draft summary;
- links to settings pages;
- preserve observation/import, validation, revision history, comparison, publish, deploy, rollback.

### Why first

This removes stale product language before the new navigation exposes the page more prominently.

## Phase 2 — Navigation and context shell

### Deliverables

- horizontal desktop navigation;
- dropdowns;
- mobile drawer;
- context row;
- active parent state;
- cluster, scope, active revision, health, and active deployment indicators;
- administration menu.

### Exit gate

No feature content redesign yet. Existing pages must render inside the new shell.

## Phase 3 — Shared design primitives

### Deliverables

- tokens;
- PageHeader and PageContainer;
- settings primitives;
- tables;
- dialogs;
- status badges;
- list editors;
- duration and network controls;
- loading, empty, error, stale, and partial states.

## Phase 4 — Golden feature: Blocked Services

Implemented on 1 August 2026. The desired-state schema, Save Draft lifecycle,
deployment writer, read-back verification, and drift hashes remain unchanged.
Catalogue metadata is controller-mediated, cached per node version/capability,
and excluded from desired state.

### Deliverables

- service catalogue API integration;
- grouped searchable catalogue;
- schedule;
- compatibility validation;
- Save Draft lifecycle;
- tests.

### Why first

This is the clearest example of transport-oriented UI that must become product-oriented UI.

## Phase 5 — Filter subscriptions

Phase 5A (DNS Blocklists presentation) was implemented on 1 August 2026 and
Phase 5B (DNS Allowlists presentation) on 2 August 2026.
Existing desired URL membership, add/enable/disable reconciliation, read-back
verification, and drift behavior are unchanged. Node-reported names, IDs, rule
counts, and timestamps are exposed through a read-only controller presentation
DTO and remain outside configuration hashes. Refresh all retains the existing
audited fleet operation. Selected-row refresh is visibly unavailable because
the supported AdGuard Home request selects only blocklists versus allowlists,
not URLs or filter IDs. Both routes now use the shared filter-list table and
dialog composition while preserving separate desired arrays, copy, controller
presentation routes, API flags, and reconciliation semantics.

### Deliverables

- separate blocklist and allowlist routes;
- tables and dialogs;
- refresh selected/all;
- observed rule count and freshness;
- node deployment state.

## Phase 6 — Clients

### Deliverables

- searchable table;
- add/edit dialog;
- identifier editor;
- tags;
- service catalogue reuse;
- removal confirmation;
- inherited policy presentation.

## Phase 7 — DNS Rewrites

### Deliverables

- searchable table;
- validation;
- add/edit dialog;
- delete confirmation;
- revision and convergence context.

## Phase 8 — DHCP presentation and safety tools

### Deliverables

- interface discovery;
- active-DHCP check;
- active leases;
- static lease table/dialog;
- duration and network validation;
- reset actions only with explicit audit and confirmation.

Preserve one-active-node validation and disable-before-enable deployment ordering.

## Phase 9 — General settings refinement

Phase 9A (General Settings presentation) and Phase 9B (DNS Settings
presentation) were implemented on 2 August 2026. Phase 9B preserves schema-v2
collection semantics and the existing capability/deployment path while adding
specialist resolver editors, network validation, conditional address fields,
exact byte/duration presentation, terminology fixes, and lifecycle context.
Upstream testing and operational clear/reset commands remain unimplemented and
must use the separate audited-command boundary in Phase 9C.

### Deliverables

- structured ignored-domain lists;
- friendly durations;
- human-readable cache size;
- conditional custom blocking fields;
- terminology fixes;
- upstream testing;
- operational clear/reset actions.

## Phase 10 — Regression and cleanup

### Deliverables

- remove unused sidebar and old components;
- update docs;
- run complete test suite;
- visual regression;
- accessibility;
- mobile;
- systemd/Docker packaged checks.

## Release gate

Release 0.4.1 is complete when:

- Release 0.4 behaviour is preserved;
- navigation matches the approved structure;
- Configuration Control is schema-v2 aligned;
- Blocked Services, filters, clients, rewrites, and DHCP use operator-appropriate controls;
- unknown routes cannot masquerade as Dashboard;
- no secret or DHCP safety regression exists;
- documentation matches implementation.
