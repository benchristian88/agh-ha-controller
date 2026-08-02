> Status: Reference material.
>
> This document records the AdGuard Home upstream UI and API model.
> It is not the authoritative implementation specification for AGH HA Controller.
> For current controller design decisions, see:
> - `navigation-and-shell.md`
> - `feature-presentation-rules.md`
> - `screen-migration-specifications.md`
> - `release-0.4-ui-implementation-audit.md`


# AdGuard Home Visible Setting and Interaction Catalogue

## Purpose

Catalogue the visible operator concepts and the control patterns AGH HA Controller should implement.

The catalogue deliberately describes **operator controls**, not merely API field types.

## Control selection rule

| API/data concept | Default UI control |
|---|---|
| Boolean | Switch |
| Small fixed enum | Radio group or segmented control |
| Larger fixed enum | Select |
| Known catalogue of IDs | Searchable grouped checkbox/toggle catalogue |
| Structured record list | Table plus add/edit dialog |
| Ordered string list | Repeatable rows or specialist multiline editor |
| Domain-specific rule syntax | Code/rule editor with validation |
| Duration | Friendly duration select plus custom duration |
| IP, subnet, CIDR | Validated network field |
| Port | Numeric field with range validation |
| Secret/certificate | Secret-aware field or file/reference workflow |
| Time schedule | Day/time schedule editor |
| Destructive command | Explicit confirmation dialog |
| Read-only runtime data | Status card/table |

## 1. Dashboard

| Visible concept | Recommended interaction | Controller extension |
|---|---|---|
| Protection enabled | Primary protection switch with pause duration | Cluster protection desired state and node convergence |
| DNS queries | Metric card | Cluster total plus node attribution |
| Blocked queries | Metric card | Cluster total and percentage |
| Malware/phishing blocked | Metric card | Aggregate only when collection complete |
| Adult-content blocked | Metric card | Aggregate only when collection complete |
| Average processing time | Metric card | Weighted cluster calculation |
| Query activity | Time-series chart | Cluster and per-node series |
| Top clients | Ranked table/list | Node attribution and combined identity |
| Top queried domains | Ranked table/list | Cluster view |
| Top blocked domains | Ranked table/list | Cluster view |
| Recent queries | Table preview | Required Node column |
| Clear cache | Button with confirmation | Deploy operation to selected/all nodes |
| Refresh | Button or automatic polling | Poll state with last-updated timestamp |

## 2. Settings > General

| Visible concept | Recommended interaction | Confidence |
|---|---|---|
| Protection enabled | Switch, with optional pause duration | Verified API |
| Filtering enabled | Switch | Verified API |
| Filtering update interval | Friendly select/custom interval | High confidence |
| Safe Browsing | Switch | Verified |
| Parental control | Switch | Verified |
| Safe Search master state | Switch | Verified |
| Search-engine-specific Safe Search | Switches per provider in modal/group | Verified schema, high-confidence UI |
| Query log enabled | Switch | Verified |
| Query-log retention | Duration select plus custom value | Verified |
| Anonymise client IP | Switch | Verified schema mapping |
| Ignored query-log domains | Structured list/editor dialog | Verified component presence |
| Statistics enabled/retention | Duration select plus custom value | Verified |
| Clear query log | Destructive button | Verified |
| Reset statistics | Destructive button | Verified |
| Automatically update filters | Interval selection | High confidence |

## 3. Settings > DNS

### Upstream DNS servers

| Concept | Recommended interaction |
|---|---|
| Primary upstreams | Specialist multiline editor supporting AGH upstream syntax |
| Parallel requests | Radio/strategy selection |
| Fastest IP | Radio/strategy selection |
| Load balancing | Radio/strategy selection |
| Test upstreams | Button with per-server validation results |
| Bootstrap DNS servers | Specialist multiline editor |
| Fallback DNS servers | Specialist multiline editor |
| Private reverse DNS servers | Specialist multiline editor |
| Use private reverse resolvers | Switch |
| Enable reverse resolving clients | Switch |

### DNS server configuration

| Concept | Recommended interaction |
|---|---|
| Rate limit | Numeric field |
| Rate-limit subnet length IPv4/IPv6 | Numeric fields |
| Rate-limit allowlist | Repeatable IP/CIDR list |
| Blocking mode | Radio/select: default, refused, nxdomain, null IP, custom IP |
| Custom blocking IPv4/IPv6 | Validated IP fields shown conditionally |
| EDNS Client Subnet | Switch plus optional settings |
| DNSSEC | Switch |
| Disable IPv6 answers | Switch |
| Cache enabled | Switch or derived from cache size |
| Cache size | Numeric size field |
| Minimum/maximum TTL override | Duration/numeric fields |
| Optimistic caching | Switch |
| Serve stale responses | Switch |
| Upstream timeout | Duration field |
| Bogus NXDOMAIN | Repeatable IP/CIDR list |
| Access settings | Structured allowed/disallowed clients and blocked-host lists |
| Clear DNS cache | Button with confirmation |

## 4. Settings > Encryption

| Visible concept | Recommended interaction |
|---|---|
| Encryption enabled | Switch |
| Server name | Domain field |
| Force HTTPS | Switch |
| HTTPS port | Port field |
| DNS-over-TLS port | Port field |
| DNS-over-QUIC port | Port field |
| Certificate source | Radio: file paths or pasted certificate |
| Certificate path/content | File/reference or multiline certificate field |
| Private key path/content | Secret-aware field |
| Validate configuration | Button with validation output |
| Certificate status | Read-only status panel |
| Download Apple configuration | Action buttons for DoH/DoT profiles |
| Node-specific certificate | Explicit node override marker in controller |

## 5. Settings > Clients

| Visible concept | Recommended interaction |
|---|---|
| Persistent clients | Searchable table |
| Add client | Button opens structured dialog |
| Client name | Text field |
| Identifiers | Repeatable validated IP/CIDR/MAC/ClientID rows |
| Tags | Multi-select catalogue |
| Use global settings | Switches/inheritance controls |
| Filtering enabled per client | Switch |
| Safe Browsing per client | Switch |
| Parental control per client | Switch |
| Safe Search per client | Switch/configuration |
| Query logging per client | Switch |
| Statistics per client | Switch |
| Blocked services per client | Reuse service catalogue selector |
| Upstream servers per client | Specialist multiline editor |
| Remove client | Destructive confirmation |
| Runtime clients | Read-only discovered-clients table/list |
| Access settings | Structured allowed/disallowed clients and blocked hosts |

## 6. Settings > DHCP

| Visible concept | Recommended interaction |
|---|---|
| DHCP enabled | Switch |
| Interface | Select populated from node interfaces |
| Check active DHCP servers | Button with result panel |
| IPv4 gateway | IP field |
| IPv4 subnet mask | IP/netmask field |
| IPv4 range start/end | Two IP fields |
| Lease duration | Duration field |
| IPv6 range/start settings | Structured IPv6 fields |
| RA/SLAAC options | Switches/selects where supported |
| Active leases | Read-only table |
| Static leases | Table plus add/edit/delete dialogs |
| Reset leases | Destructive action |
| Reset DHCP configuration | Destructive action |
| HA scope | Require selected/designated node; do not imply active-active |

## 7. Filters > DNS Blocklists

| Visible concept | Recommended interaction |
|---|---|
| Enabled lists | Table with per-row switch |
| Name | Table column/text field in dialog |
| URL or file path | URL/path field |
| Rule count | Read-only table column |
| Last update | Read-only column |
| Add blocklist | Add dialog |
| Edit blocklist | Edit dialog |
| Remove blocklist | Confirmation |
| Refresh selected/all | Button, progress and result |
| Filtering enabled | Page-level switch where relevant |
| Update interval | General settings link or contextual control |
| Cluster status | Per-node deployment/application state |

## 8. Filters > DNS Allowlists

Same structured table pattern as blocklists, but with allowlist semantics.

| Visible concept | Recommended interaction |
|---|---|
| Allowlist subscriptions | Table |
| Enable/disable | Row switch |
| Add/edit/remove | Dialog and confirmation |
| Refresh | Button |
| Rule count/status | Columns |
| Cluster state | Per-node application status |

## 9. Filters > DNS Rewrites

| Visible concept | Recommended interaction |
|---|---|
| Rewrite list | Searchable table |
| Domain | Validated domain/wildcard field |
| Answer | IP, CNAME, or DNS answer field |
| Enabled globally | Page/group switch if API supports |
| Add rewrite | Dialog |
| Edit rewrite | Dialog |
| Delete rewrite | Confirmation |
| Search/filter | Search input |
| Import/export | Optional later actions |
| Cluster state | Desired revision and per-node application result |

## 10. Filters > Blocked Services

| Visible concept | Recommended interaction |
|---|---|
| Available services | Searchable grouped service catalogue |
| Service identity | Name and icon from catalogue API |
| Block/unblock | Checkbox/toggle per service |
| Service groups | Group filter/chips/categories |
| Search | Search field |
| Select all in group | Group action |
| Inactivity schedule | Day/time schedule editor |
| Nothing found | Purposeful empty result |
| Selected count | Summary |
| Save | Save Draft in controller |
| Compatibility | Show services unsupported by older nodes |

This page must **not** be a free-text list of service IDs.

## 11. Filters > Custom Filter Rules

| Visible concept | Recommended interaction |
|---|---|
| Rules | Specialist multiline/code editor |
| Syntax help | Inline documentation/link |
| Validation | Parse/check action and inline diagnostics |
| Save | Save Draft |
| Rule count | Metadata |
| Test a host | Host/client/query-type test form |
| Search within rules | Editor search |
| Revision diff | Structured line-level comparison |

A text editor is appropriate here because rule text is the actual domain representation.

## 12. Query Log

| Visible concept | Recommended interaction |
|---|---|
| Query records | Paginated/infinite table |
| Search | Domain/client search field |
| Response status | Filter select/chips |
| Time paging | Older-than cursor or pagination |
| Client | Column/link |
| Domain | Column/action |
| Query type | Column |
| Response/status | Badge |
| Processing time | Column |
| Upstream | Detail |
| Filtering rule/reason | Detail |
| Add allow/block rule | Contextual action |
| Clear log | Destructive action |
| Log configuration | Link/dialog |
| Node | Mandatory column in cluster view |

## 13. Setup Guide

| Visible concept | Recommended interaction |
|---|---|
| Router configuration | Instruction cards |
| Device operating systems | Tabs/cards |
| DNS server addresses | Copy buttons |
| Encrypted DNS endpoints | Copy/download actions |
| Apple mobileconfig | Download buttons |
| HA instructions | Show both node addresses and failure test |

## Audit basis

This audit uses the current `master` branch of:

- `client_v2/src/components`
- `client_v2/src/components/Routes`
- `openapi/openapi.yaml`

Repository:

- https://github.com/AdguardTeam/AdGuardHome

The OpenAPI specification states that the AdGuard Home administrative web interface is built on the REST API. The v2 frontend contains separate feature components for Dashboard, Settings, DNS Settings, Encryption, Clients, DHCP, Filter Lists, Blocked Services, Query Log, User Rules, and Setup Guide.

### Confidence labels

- **Verified** — route, feature component, and API operation are confirmed in the repository.
- **High confidence** — API mapping and visible product behaviour are clear, but an exact current screen label or widget should be visually checked.
- **Needs visual verification** — the API operation is known, but the exact v2 control needs confirmation from a running AdGuard Home instance or screenshots.

This is a design audit, not a recommendation to copy AdGuard Home source code or branding.
