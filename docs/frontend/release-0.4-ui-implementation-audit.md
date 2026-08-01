# AGH HA Controller UI Audit Against the AdGuard Home v2 Audits

## Purpose

Compare the implemented Release 0.4 controller UI and execution path with:

- `docs/frontend/adguard-v2-menu-route-audit.md`;
- `docs/frontend/adguard-visible-setting-catalogue.md`;
- `docs/frontend/adguard-ui-api-operation-map.md`.

This is an implementation audit, not a proposal to copy AdGuard Home source code or assets. It assesses the controller at repository HEAD on 31 July 2026. It uses the implementation, tests, ADRs, feature ledger, changelog, and roadmap as the source of truth.

## Classification definitions

| Classification | Meaning in this audit |
|---|---|
| Matches | The operator outcome, controller UI, desired-state model, and required node API execution are present at an appropriate Release 0.4 quality level. |
| Functionally correct but poor presentation | The desired state is modelled, saved, deployed, and verified, but the control is materially less usable than the audited AdGuard interaction pattern. |
| Partially implemented | Some layers or controls exist, but the operator workflow, data coverage, validation, action, or contextual state is incomplete. |
| Missing | No usable controller implementation or explicit accepted deferral was found. |
| Intentionally different | The controller deliberately diverges because of HA scope, source-of-truth, security, authentication, or safety architecture. |
| Deferred | The repository explicitly assigns the feature to a later release or dependency. |

`Deferred` does not mean that a route or placeholder is acceptable. It records roadmap scope only. The current router often renders Dashboard for unknown paths, which can conceal a deferred or missing route.

## Architecture boundary used for the comparison

Release 0.4 does not directly reproduce the AdGuard Home administration model:

```text
Controller settings UI
  -> optimistic schema-v2 draft
  -> validation and capability preflight
  -> immutable revision
  -> durable sequential deployment
  -> version-aware AdGuard Home API writes
  -> read-back verification
  -> drift detection and reconciliation
```

This boundary is correct and must be preserved. Routine settings pages answer “what should the cluster configuration be?” Configuration Control should answer “what draft is approved as an immutable revision?” Deployments and Drift should answer “did every node apply it and remain converged?”

Direct operational commands may bypass revision publication only when they are explicitly modelled, confirmed where destructive, and audited. Release 0.4 currently implements filter refresh this way.

## Executive findings

- The schema-v2 backend and AdGuard adapter cover substantially more of AdGuard Home than the current presentation suggests. DNS, clients, rewrites, safety services, policy settings, filters, and guarded DHCP generally have real read/write/read-back paths.
- The largest Release 0.4 weakness is presentation. Filter subscriptions, persistent clients, rewrites, blocked services, ignored hosts, identifiers, tags, and static leases use textareas or large inline forms where the audit calls for tables, catalogues, validation, search, and dialogs.
- The largest functional Release 0.4 UI gap is the blocked-services catalogue. The controller reads and writes selected IDs and schedules but never calls `/control/blocked_services/all`; operators must type raw IDs even though the source audit explicitly prohibits that UI.
- TLS mutation is intentionally excluded. The controller correctly strips certificate chains, keys, and paths at the adapter boundary and shows node-attributed redacted inventory only.
- DHCP correctly enforces one active node and disable-before-enable deployment ordering, but interface discovery, active-server checks, active lease display, reset actions, and richer IPv6/RA controls are absent.
- Statistics aggregation and the combined Query Log are correctly deferred to Releases 0.5 and 0.6. Their node-local policy is already managed in 0.4.
- The current flat sidebar and seven broad settings routes intentionally differ from the new menu audit’s horizontal Settings/Filters/HA hierarchy. They are usable but do not provide the requested hierarchy, parent active state, mobile drawer, or scope context.
- `/ha/configuration` retains schema-v1 wording and a narrow duplicate DNS/filter editor. Its observation, import, validation, revision, comparison, deployment, and rollback functions remain important, but its authoring presentation is stale relative to schema v2.

## 1. Navigation and route audit

### 1.1 Route parity

| Audited menu/route | Release 0.4 implementation | Classification | Finding / required action |
|---|---|---|---|
| Dashboard `/` | `/` renders cluster and node health | Partially implemented | Correct route and health shell; traffic/statistics content is deferred to 0.5. |
| Statistics `/statistics` | No route or navigation item | Deferred | Release 0.5 owns polling, aggregation, weighted metrics, coverage, and node/cluster views. Add an explicit route in 0.5; unknown paths currently fall through to Dashboard. |
| Settings > General `/settings/general` | Controls are split across DNS, Filters, Services & Safety, and Logs & Statistics | Intentionally different | Release 0.4 grouped settings by controller workflow rather than AdGuard v2 menu parity. Reconsider during navigation redesign; retain one underlying draft. |
| Settings > DNS `/settings/dns` | `/settings/dns` | Matches | Correct cluster-wide desired-state route. |
| Settings > Encryption `/settings/encryption` | TLS inventory is grouped into `/settings/infrastructure` | Intentionally different | TLS is observed-only and node-attributed; mutation is excluded until secret references exist. A dedicated inventory route remains a presentation option. |
| Settings > Clients `/settings/clients` | `/settings/clients` | Matches | Correct route and cluster scope. |
| Settings > DHCP `/settings/dhcp` | DHCP is grouped into `/settings/infrastructure` | Intentionally different | The combined infrastructure page reinforces node-specific scope and the one-active-node safety rule. |
| Filters > DNS Blocklists `/filters/blocklists` | Blocklists share `/settings/filters` | Functionally correct but poor presentation | Desired URLs and refresh work, but there is no list-specific route or table. |
| Filters > DNS Allowlists `/filters/allowlists` | Allowlists share `/settings/filters` | Functionally correct but poor presentation | Same limitation as blocklists. |
| Filters > DNS Rewrites `/filters/rewrites` | `/settings/rewrites` | Intentionally different | The function has a dedicated page but not under the audited Filters hierarchy. |
| Filters > Blocked Services `/filters/blocked-services` | `/settings/services` also contains safety controls | Functionally correct but poor presentation | Desired IDs and schedule work, but the combined page and free-text ID editor obscure the product function. |
| Filters > Custom Rules `/filters/custom-rules` | Custom rules share `/settings/filters` | Functionally correct but poor presentation | The underlying ordered rule text is appropriate, but the page lacks a specialist editor and dedicated route. |
| Query Log `/query-log` | No route or navigation item | Deferred | Combined query ingestion/search is Release 0.6. Node-local query-log policy is available under `/settings/privacy`. |
| HA > Nodes `/ha/nodes` | `/ha/nodes` | Matches | Node registration, testing, credentials, trust, enablement, maintenance, and status are present. |
| HA > Configuration Control `/ha/configuration` | `/ha/configuration`, labelled “Configuration” | Partially implemented | Core lifecycle functions exist, but schema-v1 copy and the narrow duplicate editor should be replaced by a schema-v2 draft summary and links to settings pages. |
| HA > Deployments `/ha/deployments` | `/ha/deployments` combines deployments and drift | Matches | Durable jobs, ordered per-node results, cancellation, and progress are present. |
| HA > Drift `/ha/drift` | Combined into `/ha/deployments` | Intentionally different | Restore, adopt, maintenance, and policy controls are present on the combined page. A dedicated route is a later navigation refinement. |
| HA > Change History `/ha/history` | Revision history and comparison are on `/ha/configuration` | Intentionally different | Immutable history exists; dedicated history/detail routes remain a navigation refinement. |
| Setup Guide `/setup-guide` | No route or controller feature | Missing | No explicit roadmap assignment was found. Define scope for router/device guidance, both-node addressing, encrypted endpoints, and failure testing. |

### 1.2 Navigation rules and context

| Audited rule | Release 0.4 implementation | Classification | Finding / required action |
|---|---|---|---|
| Horizontal desktop navigation | Sticky vertical sidebar | Intentionally different | Existing frontend design selected a sidebar. The newer audit recommends horizontal dropdowns; adopting that is a deliberate navigation redesign, not a small parity fix. |
| Settings, Filters, and HA dropdown hierarchy | Flat links grouped by text labels | Missing | There are no interactive parents, dropdowns, or nested filter routes. |
| Parent active state | Active leaf link only | Missing | No parent menu exists to mark active. |
| Mobile drawer with the same hierarchy | Sidebar becomes a horizontally scrolling bar | Partially implemented | Navigation remains reachable but does not match the audited drawer/hierarchy or scale well as routes increase. |
| Routine AGH settings outside HA | Settings links are under “AdGuard Home” | Matches | The duplicate in-page settings menu was removed. |
| Revisions/drift outside generic settings | Kept under HA management | Matches | Configuration and Deployments & Drift retain the HA boundary. |
| Active cluster context | Cluster select in the top bar | Matches | Current cluster is visible globally. |
| Entire cluster / selected node scope | No scope selector | Missing | DHCP renders per-node cards, but there is no general scope context or selected-node mode. |
| Active revision context | Not shown globally | Missing | Active state appears only in revision/deployment surfaces. |
| Cluster health context | Dashboard badge only | Partially implemented | Not visible in the global context row. |
| Active deployment context | Deployment page only | Missing | No global active-deployment indicator. |
| Old-route redirects | No redirect table or router | Missing | Exact path matching plus Dashboard fallback can silently mask moved, missing, or mistyped routes. |
| Page title terminology | Mostly operator-facing; Configuration remains stale | Partially implemented | Settings titles are clear. Configuration still says schema v1 and “Draft, publish, and deploy.” |
| Avoid raw API structures by default | Forms are typed; configuration diffs render JSON values | Partially implemented | Routine settings avoid JSON, but diff/history presentation remains technical and some list concepts are raw newline strings. |

## 2. Visible setting and interaction catalogue

### 2.1 Dashboard

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Protection enabled | Draft switch exists on DNS Settings; no dashboard switch or pause duration | Partially implemented | Decide whether protection is revisioned desired state, an audited timed operation, or both; expose convergence if placed on Dashboard. |
| DNS queries | No statistics ingestion or metric | Deferred | Release 0.5. |
| Blocked queries | No statistics ingestion or metric | Deferred | Release 0.5. |
| Malware/phishing blocked | No aggregate | Deferred | Release 0.5, with incomplete-node coverage. |
| Adult-content blocked | No aggregate | Deferred | Release 0.5, with incomplete-node coverage. |
| Average processing time | No aggregate | Deferred | Release 0.5 must use weighted calculation. |
| Query activity | No chart | Deferred | Release 0.5. |
| Top clients | No ranked traffic data | Deferred | Release 0.5/0.6 data dependency. |
| Top queried domains | No ranked traffic data | Deferred | Release 0.5/0.6 data dependency. |
| Top blocked domains | No ranked traffic data | Deferred | Release 0.5/0.6 data dependency. |
| Recent queries | No preview | Deferred | Release 0.6; retain mandatory node attribution. |
| Clear DNS cache | No controller endpoint or UI | Missing | Add an explicit audited selected/all-node command with confirmation and per-node results. |
| Refresh / automatic polling | Node health polls every 30 seconds and shows refreshed/stale state | Partially implemented | Matches health refresh only; traffic refresh arrives with 0.5. |
| Node health and controller independence | Health cards, compatibility, latency, last-seen, stale state, and availability boundary | Matches | This is a controller extension beyond the AdGuard dashboard. |

### 2.2 Settings > General

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Protection enabled | Schema-v2 DNS draft; deployed through `/control/dns_config` and verified | Matches | Pause duration is not implemented; add only with explicit desired/operational semantics. |
| Filtering enabled | Draft switch; filtering read/write/read-back path | Matches | — |
| Filtering update interval | Numeric hours input; capability-gated and deployed | Functionally correct but poor presentation | Use presets plus custom duration and explain patch-level compatibility. |
| Safe Browsing | Draft switch; status read and enable/disable commands | Matches | — |
| Parental control | Draft switch; status read and enable/disable commands | Matches | — |
| Safe Search master state | Draft switch; status read and settings update | Matches | — |
| Per-provider Safe Search | Seven provider switches; patch capability for Ecosia | Matches | Improve grouping and human-readable provider labels. |
| Query-log enabled | Draft switch; config read/update/read-back | Matches | This is node-local policy, not central log ingestion. |
| Query-log retention | Numeric days input mapped to milliseconds | Functionally correct but poor presentation | Use friendly duration choices plus custom duration. |
| Anonymise client IP | Draft switch and query-log config update | Matches | — |
| Ignored query-log domains | Newline textarea plus enable switch; read/write path exists | Functionally correct but poor presentation | Use a structured list/editor with per-entry validation. |
| Statistics enabled and retention | Draft switch and numeric days; stats config read/update | Functionally correct but poor presentation | Use friendly duration controls; distinguish node policy from 0.5 aggregation. |
| Statistics ignored domains | Newline textarea plus capability-aware enable flag; the enable switch is currently misplaced in the Query Log card with the same label as the query-log switch | Functionally correct but poor presentation | Move the switch into Statistics and use a structured list/editor. |
| Clear query log | No controller action | Missing | Add a destructive, confirmed, audited per-node/fleet operation separately from policy revisions. |
| Reset statistics | No controller action | Missing | Add a destructive, confirmed, audited per-node/fleet operation. |
| Automatically update filters | Same numeric update interval on Filters | Functionally correct but poor presentation | Link General and Filters concepts or use one canonical control location. |

### 2.3 Settings > DNS — upstreams and resolver mode

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Primary upstreams | Ordered newline textarea; `/control/dns_info` and `/control/dns_config` | Functionally correct but poor presentation | Add syntax help, parsing feedback, row/error attribution, and upstream testing. |
| Parallel requests | Upstream mode select | Matches | — |
| Fastest IP/address | Upstream mode select | Matches | Terminology could align with AdGuard Home. |
| Load balancing | Upstream mode select | Matches | — |
| Test upstreams | No controller API or UI for `/control/test_upstream_dns` | Missing | Add an audited non-mutating test with per-upstream results. |
| Bootstrap DNS | Newline textarea and read/write path | Matches | Structured validation would improve it. |
| Fallback DNS | Ordered newline textarea and read/write path | Matches | Structured validation would improve it. |
| Private reverse DNS | Newline textarea and read/write path | Matches | — |
| Use private reverse resolvers | Draft switch and DNS payload | Matches | — |
| Resolve client names | Draft switch and DNS payload | Matches | — |

### 2.4 Settings > DNS — server configuration

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Rate limit | Numeric field, domain validation, DNS payload | Matches | — |
| IPv4/IPv6 rate-limit subnet lengths | Numeric fields with server bounds validation | Matches | Add inline ranges/help. |
| Rate-limit allowlist | Newline textarea with IP/CIDR server validation | Functionally correct but poor presentation | Use repeatable validated network rows. |
| Blocking mode | Select with supported enum | Matches | — |
| Custom blocking IPv4/IPv6 | Plain inputs, server IP validation, always visible | Functionally correct but poor presentation | Show conditionally for custom mode and validate inline. |
| EDNS Client Subnet | Master and custom-address switches plus input | Matches | — |
| DNSSEC | Draft switch and DNS payload | Matches | — |
| Disable IPv6 answers | Draft switch labelled “Disable IPv6 resolution” | Functionally correct but poor presentation | Correct the operator terminology to answers. |
| Cache enabled | Capability-aware switch | Matches | Older patch versions retain imported values. |
| Cache size | Numeric bytes field | Functionally correct but poor presentation | Use human-readable size units and constraints. |
| Minimum/maximum TTL override | Numeric fields | Functionally correct but poor presentation | Use duration controls and inline min/max validation. |
| Optimistic caching | Draft switch | Matches | — |
| Serve stale responses | Not represented in schema v2 | Missing | Add only after confirming the supported AdGuard contract and verification semantics. |
| Upstream timeout | Capability-aware seconds field | Matches | A duration control would improve presentation. |
| Bogus NXDOMAIN | Not represented | Missing | Requires model, adapter, validation, API contract, UI, tests, and docs. |
| Access settings | `/control/access/list` and `/control/access/set` are not used | Missing | Requires a separate structured access-policy model; do not merge it silently with persistent clients. |
| Clear DNS cache | No `/control/cache_clear` controller operation | Missing | Add as a confirmed audited command with per-node results. |

### 2.5 Settings > Encryption

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Encryption enabled | Read from `/control/tls/status`, shown per node, not editable | Intentionally different | TLS is redacted inventory-only in 0.4. |
| Server name | Read and shown per node | Matches | Inventory outcome matches; mutation is deferred. |
| Force HTTPS | Read into observed model but not shown | Partially implemented | Add to redacted inventory if operationally useful. |
| HTTPS, DoT, and DoQ ports | Read and shown per node | Matches | — |
| Serve plain DNS | Read into observed model but not shown | Partially implemented | Add to inventory presentation. |
| Certificate source | No desired model or UI | Deferred | Requires controller-managed secret-reference design. |
| Certificate path/content | Deliberately discarded; never returned to browser | Intentionally different | Preserve this security boundary. Future mutation must use references, not plaintext desired state. |
| Private key path/content | Deliberately discarded; never returned to browser | Intentionally different | Preserve this security boundary. |
| Validate proposed TLS configuration | No `/control/tls/validate` operation | Deferred | Depends on safe mutation/reference workflow. |
| Certificate status | Valid-pair summary shown; subject, issuer, validity, names, and warning are modelled but not displayed | Partially implemented | Expand the redacted status card without exposing secret material. |
| Download Apple DoH/DoT profiles | No controller route/action | Missing | Safe read-only action, but not assigned to 0.4 or a later release. |
| Node-specific certificate marker | TLS cards are explicitly node-attributed | Matches | — |
| TLS configuration writes | `/control/tls/configure` is never called | Deferred | Explicitly excluded by Release 0.4 and ADR-0025. |

### 2.6 Settings > Clients

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Persistent clients | Complete desired model and `/control/clients` reconciliation; rendered as stacked cards | Functionally correct but poor presentation | Use a searchable summary table with add/edit detail dialogs. |
| Add client | Button appends a large inline card | Functionally correct but poor presentation | Use a structured dialog and focus management. |
| Client name | Text input with non-empty/unique server validation | Matches | Add inline validation. |
| Identifiers | Newline textarea; non-empty and cross-client uniqueness validation | Functionally correct but poor presentation | Use validated repeatable IP/CIDR/MAC/ClientID rows. |
| Tags | Newline textarea | Functionally correct but poor presentation | Use the AdGuard tag catalogue/multi-select where available. |
| Use global settings | Inheritance switch | Matches | — |
| Filtering per client | Switch and client payload | Matches | — |
| Safe Browsing per client | Switch and client payload | Matches | — |
| Parental control per client | Switch and client payload | Matches | — |
| Safe Search per client | Master/provider switches and client payload | Matches | Provider controls should be grouped. |
| Query logging per client | Inverse “Exclude from query log” switch maps to `ignore_querylog` | Matches | Consider wording it as an explicit inheritance/override outcome. |
| Statistics per client | Inverse “Exclude from statistics” switch maps to `ignore_statistics` | Matches | Same presentation note as query logging. |
| Blocked services per client | Raw ID textarea plus schedule | Functionally correct but poor presentation | Reuse the missing searchable service catalogue selector. |
| Upstream servers per client | Ordered newline textarea and client payload | Functionally correct but poor presentation | Add AGH syntax help and validation. |
| Upstream response cache | Enable switch and numeric size are implemented | Matches | This is additional complete schema-v2 coverage. |
| Remove client | Immediate inline removal from the draft; deployment performs delete | Partially implemented | Add explicit confirmation and clear “saved draft only” messaging. |
| Runtime/discovered clients | Adapter does not retain or expose `auto_clients` | Missing | Add observed-only node-attributed runtime client inventory if in scope. |
| Search exact clients | `/control/clients/search` is not exposed | Missing | Define whether this is an operational lookup or part of runtime-client inventory. |
| Access settings | No access-list model or UI | Missing | See DNS access settings; keep distinct from persistent-client identity. |

### 2.7 Settings > DHCP

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| DHCP enabled | Per-node “Designated active DHCP node” switch | Matches | Browser disables other draft nodes; server validation remains authoritative. |
| Interface | Free-text field persisted through `/control/dhcp/set_config` | Functionally correct but poor presentation | Read `/control/dhcp/interfaces` and use a node-specific select with availability detail. |
| Check active DHCP servers | No `/control/dhcp/find_active_dhcp` action | Missing | Add a non-mutating node-specific check before enabling or handing off DHCP. |
| IPv4 gateway | Plain text field with server-side IP validation | Functionally correct but poor presentation | Add inline IP validation. |
| IPv4 subnet mask | Plain text field with server-side validation | Functionally correct but poor presentation | Add inline netmask validation. |
| IPv4 range start/end | Plain text fields with ordering/subnet server validation | Functionally correct but poor presentation | Present as a paired network-range control with inline diagnostics. |
| Lease duration | Numeric seconds field | Functionally correct but poor presentation | Use a duration control. |
| IPv6 range/start | Range start and lease duration are modelled | Partially implemented | The audited wider IPv6 structure is not covered. |
| RA/SLAAC options | Not represented | Missing | Confirm version support before extending schema/capabilities. |
| Active leases | Read as observed-only `dhcpLeases` but not rendered | Partially implemented | Add a read-only node-attributed table and freshness timestamp. |
| Static leases | Full read/reconcile path; inline rows for add/edit/remove | Functionally correct but poor presentation | Use a table and dialogs with validation and delete confirmation. |
| Update static lease API | Implemented as verified remove-then-add by MAC | Intentionally different | The reconciliation strategy is compatible with immutable desired state; failures remain deployment results. |
| Reset leases | No `/control/dhcp/reset_leases` operation | Missing | Add only as destructive confirmed audited node operation. |
| Reset DHCP configuration | No `/control/dhcp/reset` operation | Missing | Add only as destructive confirmed audited node operation. |
| HA scope | At most one enabled DHCP node; disable-before-enable deployment ordering | Matches | This is a required controller extension and deliberate difference from single-node AdGuard Home. |

### 2.8 Filters > DNS Blocklists

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Enabled lists | Desired URL set reconciles enabled state | Functionally correct but poor presentation | Replace textarea with table rows and switches. |
| Name | Read from nodes but discarded from desired UI; new entries use “Managed by AGH HA Controller” | Partially implemented | Decide whether list name is desired metadata or derived display metadata. |
| URL/file path | HTTP(S) URLs only; newline textarea | Functionally correct but poor presentation | Use validated URL rows/dialog. Local file-path support is intentionally not assumed across nodes. |
| Rule count | Not retained or displayed | Missing | Add observed metadata without making volatile counts part of drift. |
| Last update | Not retained or displayed | Missing | Add observed metadata/freshness without desired-state ownership. |
| Add blocklist | Adding a URL to the textarea leads to `/control/filtering/add_url` on deployment | Functionally correct but poor presentation | Use add dialog and show draft/deployment state. |
| Edit blocklist | URL changes become disable old/add new reconciliation | Functionally correct but poor presentation | Present as edit semantics and preview the effective change. |
| Remove blocklist | Removing URL disables it during deployment; no UI confirmation | Partially implemented | Add confirmation and make disable-versus-delete behavior explicit. |
| Refresh selected/all | Audited fleet refresh exists for all blocklists | Partially implemented | Add selected rows, durable per-node progress/results, and last-refresh metadata. |
| Filtering enabled | Page-level switch | Matches | — |
| Update interval | Numeric hours | Functionally correct but poor presentation | Use friendly presets/custom duration. |
| Cluster status | Available indirectly in revisions/deployments/drift | Partially implemented | Show current draft/revision and per-node application state on the list page. |

### 2.9 Filters > DNS Allowlists

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Allowlist subscriptions | Desired URL set, read/write/reconcile path | Functionally correct but poor presentation | Use a dedicated table. |
| Enable/disable | Membership in textarea controls enabled state | Functionally correct but poor presentation | Use row switches. |
| Add/edit/remove | End-to-end reconciliation exists | Functionally correct but poor presentation | Add dialogs, validation, and confirmation. |
| Refresh | Audited fleet allowlist refresh exists | Partially implemented | Add selected refresh and richer per-node result presentation. |
| Rule count/status | Not retained or displayed | Missing | Keep as observed metadata, excluded from drift. |
| Cluster state | Indirect through HA pages | Partially implemented | Add revision/convergence context to the page. |

### 2.10 Filters > DNS Rewrites

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Rewrite list | Complete desired model and add/update/delete reconciliation; inline rows | Functionally correct but poor presentation | Use a searchable table. |
| Domain | Text input; server validates non-empty/unique pair only | Partially implemented | Add domain/wildcard validation and inline diagnostics. |
| Answer | Text input; server validates non-empty only | Partially implemented | Validate supported IP/CNAME/answer forms. |
| Enabled globally | Capability-aware switch and settings endpoint | Matches | Older nodes retain imported default when toggle is unsupported. |
| Add rewrite | Adds inline row | Functionally correct but poor presentation | Use a focused add dialog. |
| Edit rewrite | Inline fields and `/control/rewrite/update` reconciliation | Functionally correct but poor presentation | Use row action/dialog and validation. |
| Delete rewrite | Immediate draft removal, no confirmation | Partially implemented | Add confirmation and clarify that Save Draft/Publish/Deploy is still required. |
| Search/filter | No search | Missing | Add client-side search over desired rewrites. |
| Import/export | No action | Deferred | The source catalogue already marks this optional later work. |
| Cluster state | Indirect through HA pages | Partially implemented | Show draft revision and node convergence context. |

### 2.11 Filters > Blocked Services

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Available services | `/control/blocked_services/all` is not called | Missing | Fetch/cache version-aware catalogue metadata. |
| Service identity | Only raw IDs are stored/displayed | Missing | Present human-readable name and safe project-owned/icon metadata. |
| Block/unblock | Operators edit a newline list of IDs | Functionally correct but poor presentation | Replace with checkbox/toggle catalogue. |
| Service groups | No catalogue or groups | Missing | Add grouped catalogue controls. |
| Search | No search | Missing | Search cached catalogue client-side. |
| Select all in group | No group action | Missing | Add once group metadata is available. |
| Inactivity schedule | Seven-day time editor with IANA/Local time zone | Matches | Server validates day ranges and time zone. |
| Nothing found state | No search or catalogue | Missing | Add purposeful empty result. |
| Selected count | No summary | Missing | Add alongside catalogue selection. |
| Save | Shared Save Draft path | Matches | Publish/deploy remains on Configuration Control. |
| Compatibility | Generic capability notice only; IDs are not validated against each node catalogue | Partially implemented | Validate selected IDs per target/version and report unsupported services before publication. |
| Current state API | `/control/blocked_services/get` and `/update` are used and verified | Matches | Deprecated service endpoints are not used. |

The current free-text ID control directly conflicts with the source catalogue’s explicit “must not be a free-text list” rule. It is the clearest example of “functionally correct but poor presentation” in Release 0.4.

### 2.12 Filters > Custom Filter Rules

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Rules | Ordered text is modelled and deployed through `/control/filtering/set_rules`; plain textarea UI | Functionally correct but poor presentation | Use a rule/code editor while retaining text as the domain representation. |
| Syntax help | No inline help/link | Missing | Add safe documentation and examples without copying AdGuard assets. |
| Validation | No parse/check action or rule-level diagnostics | Missing | Add controller validation or an audited non-mutating node check before publication. |
| Save | Save Draft is available | Matches | — |
| Rule count | Not shown | Missing | Show draft count and, separately, observed compiled/status metadata. |
| Test a host | `/control/filtering/check_host` is not exposed | Missing | Add non-mutating test form with node-attributed results. |
| Search within rules | Browser textarea behavior only | Missing | Specialist editor should provide search. |
| Revision diff | Whole custom-rule arrays participate in semantic revision comparison | Partially implemented | Add line-level diff presentation. |

### 2.13 Query Log

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Query records | No ingestion/storage/table | Deferred | Release 0.6. |
| Search | No combined query API/UI | Deferred | Release 0.6. |
| Response status filter | No combined query API/UI | Deferred | Release 0.6. |
| Time paging / load older | No cursor/page API/UI | Deferred | Release 0.6. |
| Client column/action | No query table | Deferred | Release 0.6. |
| Domain column/action | No query table | Deferred | Release 0.6. |
| Query type | No query table | Deferred | Release 0.6. |
| Response/status | No query table | Deferred | Release 0.6. |
| Processing time | No query table | Deferred | Release 0.6. |
| Upstream detail | No query table | Deferred | Release 0.6. |
| Filtering rule/reason | No query table | Deferred | Release 0.6. |
| Add allow/block rule | No contextual query action | Deferred | Depends on Release 0.6 and safe draft authoring linkage. |
| Clear log | No audited command | Missing | Node-local destructive action is not implemented even though central ingestion is deferred. |
| Log configuration | Node-local policy is fully managed under Logs & Statistics | Matches | Keep separate from the future query-event route. |
| Mandatory node column | No query table | Deferred | Must be present in Release 0.6. |

### 2.14 Statistics

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Statistics dashboard | No `/control/stats` polling, storage, aggregation, or route | Deferred | Release 0.5. |
| Cluster/node period selection | No statistics route | Deferred | Release 0.5. |
| Statistics retention | Node-local desired policy is read, edited, deployed, and verified | Matches | Current numeric-days presentation should become a friendly duration selector. |
| Reset statistics | No audited command | Missing | Can be implemented independently as a destructive per-node/fleet action. |
| Weighted aggregates and coverage | No aggregation | Deferred | Release 0.5 acceptance criteria. |

### 2.15 Setup Guide

| Feature/control | Current implementation and API evidence | Classification | Required action / boundary |
|---|---|---|---|
| Router configuration | No guide | Missing | Define a controller-aware setup-guide milestone. |
| Device operating systems | No guide | Missing | Add only with maintained, testable documentation. |
| DNS server addresses | Node listener addresses are observed but not presented as copyable setup guidance | Partially implemented | Reuse node-attributed observed listener data. |
| Encrypted DNS endpoints | TLS server/ports are observed but no endpoint guidance exists | Partially implemented | Derive only from validated public metadata. |
| Apple mobileconfig | No download action | Missing | Define safe proxy/direct download behavior. |
| HA instructions | Dashboard says DNS stays on nodes, but there is no both-address/router/failure-test guide | Partially implemented | Add explicit dual-node client guidance and a controller-outage test procedure. |
| Initial AGH install/configure endpoints | Controller uses its own setup and does not install/reconfigure AdGuard Home | Intentionally different | Preserve independent AdGuard Home node lifecycle unless a future onboarding decision expands scope. |

## 3. AdGuard UI/API operation coverage

This table verifies the implementation behind the visible-control classifications. “Used” means the version-aware adapter invokes the AdGuard Home operation during observation, deployment, verification, or the audited filter-refresh command.

| API operation group from source audit | Release 0.4 coverage | Classification | Evidence / gap |
|---|---|---|---|
| Status and version reads | `/control/status` used for health, version, listener identity | Matches | Node polling and observations preserve controller independence. |
| Protection command `/control/protection` | Not used; protection is desired DNS configuration | Intentionally different | Revisioned source-of-truth behavior is preferred; timed pause remains unmodelled. |
| DNS cache clear | Not used | Missing | No controller command endpoint. |
| AdGuard version check/update | Not used | Deferred | Node upgrade orchestration is later roadmap work. |
| Filtering status/config | Read and written | Matches | Includes enabled state and interval. |
| Filter add/set URL | Used by desired-set reconciliation | Matches | Removal is implemented as disable rather than destructive URL deletion. |
| Filter remove URL | Not called | Intentionally different | Controller reconciliation disables unmanaged current entries, preserving safer reversibility. Document this operator-visible behavior. |
| Filter refresh | Direct audited per-node endpoint and fleet UI action | Matches | Partial results are shown, though not durably as a job. |
| Set custom rules | Used | Matches | UI tooling remains poor. |
| Check host filtering | Not used | Missing | No test-host controller action. |
| DNS info/config | Read and written for the modelled schema-v2 fields | Matches | Managed fields are read back and compared. |
| Test upstream DNS | Not used | Missing | No controller action. |
| Access list read/set | Not used | Missing | No access-policy domain model. |
| TLS status | Read and redacted before domain/browser state | Matches | Secret material is excluded and redaction is contract-tested. |
| TLS configure/validate | Not used | Deferred | Secret-reference architecture required. |
| Apple DoH/DoT profiles | Not used | Missing | No route/action. |
| Clients read/add/update/delete | Used by set reconciliation | Matches | Full managed persistent-client payload is covered. |
| Clients search | Not used | Missing | No exact/runtime lookup feature. |
| DHCP status | Read, with dynamic leases observed-only and static leases desired | Matches | Active leases are not yet displayed. |
| DHCP set config | Used | Matches | Guarded by single-active validation and deployment ordering. |
| DHCP interface discovery | Not used | Missing | UI uses free text. |
| Find active DHCP | Not used | Missing | Important pre-handoff safety improvement. |
| DHCP static lease add/remove | Used by reconciliation | Matches | Update uses remove/add. |
| DHCP reset/reset leases | Not used | Missing | Must be destructive audited operations if added. |
| Blocked-services catalogue `/all` | Not used | Missing | Root cause of raw ID presentation. |
| Blocked-services get/update | Used | Matches | Selected IDs and schedule converge. |
| Rewrite list/add/update/delete | Used | Matches | UI search, validation, and confirmations are incomplete. |
| Rewrite settings get/update | Capability-aware use | Matches | Supports older schema-v2 nodes without assuming the endpoint. |
| Safe Browsing and parental status/commands | Used | Matches | Boolean desired state translated to enable/disable commands. |
| Safe Search status/settings | Used | Matches | Patch-level Ecosia capability is explicit. |
| Query-log config read/update | Used | Matches | Policy only in 0.4. |
| Query-log records/search/page | Not used | Deferred | Release 0.6. |
| Query-log clear | Not used | Missing | Destructive node operation absent. |
| Statistics config read/update | Used | Matches | Policy only in 0.4. |
| Statistics data | Not used | Deferred | Release 0.5. |
| Statistics reset | Not used | Missing | Destructive node operation absent. |
| AdGuard install/login/logout/profile APIs | Not used | Intentionally different | Controller has its own setup, local authentication, sessions, CSRF, and encrypted node credentials. |

## 4. HA controller-specific features not represented by the AdGuard parity catalogue

These are not parity gaps. They are the controller’s core product value.

| Controller feature | Release 0.4 status | Classification |
|---|---|---|
| One authoritative desired draft | Optimistic schema-v2 draft shared by all settings routes | Matches |
| Immutable revisions | Numbered, hashed, summarised revisions | Matches |
| Semantic revision and snapshot comparison | Implemented in API and Configuration UI | Matches |
| Capability-aware publication/deployment preflight | Version/schema/patch features checked across all targets | Matches |
| Durable sequential deployment | All-target preflight, stop-on-failure, ordered tasks, read-back verification | Matches |
| Per-node deployment results | Durable tasks with status/error/verification snapshot | Matches |
| Active revision only after total verified success | Implemented | Matches |
| Deployment-based rollback | Historical immutable revision is redeployed and audited | Matches |
| Drift detection and reconciliation | Manual, Alert, and Enforce with restore/adopt/maintenance | Matches |
| Controller outside DNS request path | Explicit runtime and UI boundary | Matches |
| TLS secret redaction | Adapter discards chains, keys, and paths before domain state | Matches |
| Single-active DHCP handoff | Validation plus disable-before-enable ordering | Matches |

## 5. Configuration Control page reconciliation

The audit confirms that `/ha/configuration` should remain, but its purpose should be lifecycle control rather than another incomplete settings editor.

### Functions that remain valid

- collect node observations and capability profiles;
- compare immutable snapshots;
- deliberately import/adopt an observation into the mutable draft;
- validate the whole desired document across enabled nodes;
- publish an immutable revision with an operator summary;
- list and compare revision history;
- preview, deploy, and roll back revisions.

### Stale Release 0.4 presentation

- The header still says schema v1 manages DNS and filtering.
- “Shared desired state” duplicates only the older DNS/filter subset.
- It does not summarize clients, rewrites, services, safety, policies, TLS inventory, or DHCP.
- Capability cards still summarize DNS and filtering rather than the schema-v2 profile.
- Import confirmation refers to shared values and a listener override rather than clearly describing the complete schema-v2 replacement/adoption boundary.

### Recommended classification

`Partially implemented`: the control-plane behavior is correct and important, but its Release 0.4 information architecture and content are stale.

The smallest compliant redesign is to rename the navigation item to **Configuration Control**, remove the duplicate editor, show a complete read-only draft/change summary with links to the seven authoring pages, retain validation/publication/history/deploy/rollback, and isolate observation/import as an advanced adoption workflow.

## 6. Prioritised follow-on work

### Priority 0 — prevent misleading navigation

1. Replace unknown-path Dashboard fallback with explicit routing, redirects, or a not-found state.
2. Reconcile `/ha/configuration` with schema v2 and its lifecycle purpose.

### Priority 1 — complete Release 0.4 presentation

1. Replace raw blocked-service IDs with the version-aware searchable grouped catalogue.
2. Replace filter URL textareas with separate blocklist/allowlist tables and dialogs.
3. Replace client cards with a searchable table and validated add/edit dialogs.
4. Replace rewrite rows with a searchable table, validation, dialogs, and delete confirmation.
5. Add DHCP interface discovery, active lease table, and active-DHCP detection.
6. Add contextual draft/revision/convergence state to settings pages.

### Priority 2 — missing operational commands

1. Test upstream DNS.
2. Clear DNS cache.
3. Clear query log.
4. Reset statistics.
5. Test host filtering.
6. DHCP reset/reset-leases actions, only with explicit node scope and confirmation.

All commands must use controller endpoints, authentication, CSRF protection, safe errors, audit records, and per-node/fleet result presentation.

### Planned later releases

- Release 0.5: statistics polling, storage, aggregation, weighted metrics, completeness, and cluster/node views.
- Release 0.6: combined node-attributed Query Log, search, filtering, pagination, retention, and contextual rule actions.
- Later operational/security scope: node upgrades, TLS secret references and mutation, richer recovery, controller HA, and other roadmap items already recorded as deferred.

### Unscheduled product decisions

- Setup Guide and Apple profile downloads.
- Access-list management.
- Runtime/discovered clients and exact-client search.
- Bogus NXDOMAIN and serve-stale DNS fields.
- Horizontal/dropdown navigation adoption versus continued sidebar evolution.

These should not be silently labelled deferred until assigned to a release or explicitly rejected.

## 7. Evidence reviewed

### Repository instructions and design records

- `AGENTS.md`;
- architecture, configuration-model, deployment, and reconciliation documentation;
- ADR-0025 and the existing architectural compendium;
- frontend design and navigation documentation;
- backend, API, database, security, operations, testing, roadmap, changelog, README, and feature-ledger records.

### Implementation

- `web/src/App.tsx`;
- `web/src/features/dashboard/DashboardPage.tsx`;
- `web/src/features/settings/ManagedSettingsPage.tsx`;
- `web/src/features/configuration/ConfigurationPage.tsx`;
- `web/src/features/controlplane/ControlPlanePage.tsx`;
- `web/src/lib/api.ts` and `web/src/lib/types.ts`;
- `internal/configuration/model.go` and validation/diff tests;
- `internal/adguard/configuration.go` and versioned contract tests;
- controller inventory, configuration, deployment, rollback, drift, maintenance, audit, and filter-refresh API handlers;
- migration `000004_release_0_4` and the Release 0.3/0.4 integration workflow.

## 8. Audit limitations

- This was a repository implementation audit, not a browser screenshot comparison against a running AdGuard Home v2 instance.
- The three source audit documents include confidence labels where exact AdGuard presentation still needs visual verification; this audit does not increase those upstream confidence levels.
- The Release 0.4 browser accessibility/visual workflow, reference-node matrix, PostgreSQL upgrade, DHCP handoff, and packaged Docker/systemd validation remain pending as recorded in the feature ledger and roadmap.
- No implementation behavior was changed by this audit.
