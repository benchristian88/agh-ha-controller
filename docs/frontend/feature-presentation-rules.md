# Feature Presentation Rules

## Core rule

The AdGuard Home API defines the transport contract. The operator-facing UI defines the product interaction.

Do not infer UI controls directly from JSON or API types.

## Default mappings

| Data concept | Operator control |
|---|---|
| Boolean | Switch |
| Small enum | Radio or segmented control |
| Large enum | Select |
| Known ID catalogue | Searchable grouped selector |
| Structured record list | Table plus add/edit dialog |
| Ordered strings | Specialist editor or repeatable rows |
| Domain-specific rules | Rule/code editor |
| Duration | Presets plus custom duration |
| IP/CIDR | Validated repeatable network rows |
| URL subscription | Table row and add/edit dialog |
| Secret | Redacted inventory or secret reference |
| Schedule | Day/time schedule editor |
| Destructive command | Scoped confirmation plus audited results |

## Required implementations

### Blocked Services

Must use:

- `/control/blocked_services/all` catalogue;
- grouped/searchable service presentation;
- human-readable names;
- selected count;
- service toggles or checkboxes;
- group actions;
- schedule editor;
- compatibility validation by node/version.

Must not use a free-text service-ID textarea.

### Blocklists and Allowlists

Must use:

- separate routes;
- tables;
- row enabled state;
- add/edit dialogs;
- URL validation;
- refresh actions;
- rule-count and last-update observed metadata;
- per-node convergence state.

### Clients

Must use:

- searchable table;
- structured add/edit dialog;
- repeatable validated identifiers;
- tag selector;
- grouped safety and inheritance controls;
- reusable blocked-service selector;
- confirmation before removal.

### DNS Rewrites

Must use:

- searchable table;
- validated domain and answer fields;
- add/edit dialog;
- delete confirmation;
- draft/revision state.

### DHCP

Must use:

- node-specific interface select from discovered interfaces;
- validated gateway/netmask/range controls;
- friendly duration;
- active lease table;
- static lease table and dialogs;
- active-DHCP detection;
- explicit one-active-node boundary.

### Custom Rules

A text editor is appropriate because rule text is the domain representation.

Add:

- syntax help;
- validation;
- test-host action;
- search;
- line-level revision diff.

## Security boundaries

TLS remains observed-only until a secret-reference architecture is approved.

Never put:

- private keys;
- certificate chains;
- certificate paths;
- plaintext node credentials

into browser state, desired-state documents, diagnostics, or audit metadata.
