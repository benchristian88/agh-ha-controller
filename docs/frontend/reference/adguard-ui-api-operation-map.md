> Status: Reference material.
>
> This document records the AdGuard Home upstream UI and API model.
> It is not the authoritative implementation specification for Atlas DNS Controller.
> For current controller design decisions, see:
> - [ADR-0026](../../decisions/ADR-0026-adopt-adguard-v2-inspired-ui-language.md)
> - [navigation and shell](../navigation-and-shell.md)
> - [feature presentation rules](../feature-presentation-rules.md)
> - [design system](../design-system.md)


# AdGuard Home UI Control to API Operation Map

## Purpose

Map operator-facing controls to AdGuard Home API operations. Atlas DNS Controller should normally call its own controller API, which then stores desired state and translates deployments into these node API calls.

## Important controller rule

AdGuard Home performs direct node updates. Atlas DNS Controller should generally use:

```text
UI control
→ save controller draft
→ publish immutable revision
→ deploy effective configuration
→ invoke node API
→ read back and verify
```

Direct command actions such as test, refresh, clear cache, and health checks may use operational controller endpoints without creating a configuration revision, but must remain audited.

## 1. Dashboard and general operation mapping

| UI control | Read API | Write/action API | Payload or result | Controller behaviour |
|---|---|---|---|---|
| Server/protection status | `GET /control/status` | — | `ServerStatus` | Poll all nodes |
| Enable/pause protection | `GET /control/status` | `POST /control/protection` | `SetProtectionRequest` | Desired state or audited operational action |
| Clear DNS cache | — | `POST /control/cache_clear` | No body | Execute selected/all nodes, show per-node result |
| Version/status | `GET /control/status` | — | Version and DNS status | Node inventory |
| Check update | — | `POST /control/version.json` | Version request/result | Probably out of initial controller scope |
| Begin node update | — | `POST /control/update` | No body | Deferred/explicit node upgrade workflow |

## 2. General settings mapping

| UI control | Read API | Write API | Mapping |
|---|---|---|---|
| Filtering settings/status | `GET /control/filtering/status` | `POST /control/filtering/config` | `FilterStatus` / `FilterConfig` |
| Safe Browsing switch | `GET /control/safebrowsing/status` | `POST /control/safebrowsing/enable` or `/disable` | Boolean translated into command endpoint |
| Parental control switch | `GET /control/parental/status` | `POST /control/parental/enable` or `/disable` | Boolean translated into command endpoint |
| Safe Search settings | `GET /control/safesearch/status` | `PUT /control/safesearch/settings` | `SafeSearchConfig` |
| Query-log settings | `GET /control/querylog/config` | `PUT /control/querylog/config/update` | Query-log enabled, interval, anonymisation and ignored data as supported |
| Clear query log | — | `POST /control/querylog_clear` | No body |
| Statistics settings | `GET /control/stats/config` | `PUT /control/stats/config/update` | Statistics interval/retention |
| Reset statistics | — | `POST /control/stats_reset` | No body |

## 3. DNS settings mapping

| UI control | Read API | Write/action API | Mapping |
|---|---|---|---|
| DNS configuration page | `GET /control/dns_info` | `POST /control/dns_config` | `DNSConfig` |
| Upstream DNS editor | `GET /control/dns_info` | `POST /control/dns_config` | `upstream_dns` |
| Upstream mode | `GET /control/dns_info` | `POST /control/dns_config` | Mode fields such as parallel/fastest/load-balancing according to schema |
| Bootstrap DNS | `GET /control/dns_info` | `POST /control/dns_config` | `bootstrap_dns` |
| Fallback DNS | `GET /control/dns_info` | `POST /control/dns_config` | `fallback_dns` |
| Private reverse upstreams | `GET /control/dns_info` | `POST /control/dns_config` | `local_ptr_upstreams`; defaults also returned |
| Test upstreams | — | `POST /control/test_upstream_dns` | `UpstreamsConfig`; per-server response map |
| Rate limiting | `GET /control/dns_info` | `POST /control/dns_config` | Rate-limit fields |
| Blocking mode | `GET /control/dns_info` | `POST /control/dns_config` | Blocking mode enum and custom addresses |
| DNSSEC | `GET /control/dns_info` | `POST /control/dns_config` | Boolean |
| EDNS Client Subnet | `GET /control/dns_info` | `POST /control/dns_config` | ECS settings |
| Cache settings | `GET /control/dns_info` | `POST /control/dns_config` | Cache size, TTL overrides, optimistic cache |
| Disable IPv6 answers | `GET /control/dns_info` | `POST /control/dns_config` | Boolean |
| Access lists | `GET /control/access/list` | `POST /control/access/set` | Allowed clients, disallowed clients, blocked hosts |

## 4. Encryption mapping

| UI control | Read API | Write/action API | Mapping |
|---|---|---|---|
| TLS status/config | `GET /control/tls/status` | `POST /control/tls/configure` | `TlsConfig` |
| Validate TLS | — | `POST /control/tls/validate` | Proposed config, validated without applying |
| DoH mobile profile | — | `GET /control/apple/doh.mobileconfig` | `host` and optional client ID |
| DoT mobile profile | — | `GET /control/apple/dot.mobileconfig` | Host/client parameters if available in current spec |

Controller note: TLS paths, certificate content, listener ports, and server names may need node-specific overrides.

## 5. Clients mapping

| UI control | Read API | Write/action API | Mapping |
|---|---|---|---|
| Persistent client list | `GET /control/clients` | — | `Clients` |
| Add client | — | `POST /control/clients/add` | `Client` |
| Update client | — | `POST /control/clients/update` | `ClientUpdate` |
| Delete client | — | `POST /control/clients/delete` | `ClientDelete` |
| Search exact clients | — | `POST /control/clients/search` | Identifiers request/result |
| Access settings | `GET /control/access/list` | `POST /control/access/set` | Access lists |
| Per-client blocked services | Client read model | Client add/update | Array of service IDs |
| Per-client upstreams | Client read model | Client add/update | Upstream string array |
| Per-client filtering/safety flags | Client read model | Client add/update | Boolean inheritance/override fields |

## 6. DHCP mapping

| UI control | Read API | Write/action API | Mapping |
|---|---|---|---|
| DHCP status/config | `GET /control/dhcp/status` | `POST /control/dhcp/set_config` | `DhcpStatus` / `DhcpConfig` |
| Interface selector | `GET /control/dhcp/interfaces` | Included in set config | `NetInterfaces` |
| Check active DHCP | — | `POST /control/dhcp/find_active_dhcp` | `DhcpFindActiveReq` / result |
| Add static lease | DHCP status | `POST /control/dhcp/add_static_lease` | `DhcpStaticLease` |
| Update static lease | DHCP status | `POST /control/dhcp/update_static_lease` | Lease update |
| Remove static lease | DHCP status | `POST /control/dhcp/remove_static_lease` | Lease identity |
| Reset DHCP | — | `POST /control/dhcp/reset` | No body |
| Reset leases | — | `POST /control/dhcp/reset_leases` | No body |

Controller note: initial HA support should designate one managed DHCP node and avoid active-active semantics.

## 7. Filter list mapping

| UI control | Read API | Write/action API | Mapping |
|---|---|---|---|
| Blocklist/allowlist table | `GET /control/filtering/status` | — | Filter arrays and rule counts |
| Add URL/list | — | `POST /control/filtering/add_url` | `AddUrlRequest`, including allowlist flag |
| Edit URL/list | — | `POST /control/filtering/set_url` | `FilterSetUrl` |
| Remove URL/list | — | `POST /control/filtering/remove_url` | `RemoveUrlRequest` |
| Refresh filters | — | `POST /control/filtering/refresh` | `FilterRefreshRequest` / response |
| Filtering configuration | `GET /control/filtering/status` | `POST /control/filtering/config` | Enabled and update interval |
| Custom rules editor | `GET /control/filtering/status` | `POST /control/filtering/set_rules` | `SetRulesRequest` |
| Test host filtering | — | `GET /control/filtering/check_host` | `name`, optional `client`, optional `qtype` |

## 8. Blocked Services mapping

| UI control | Read API | Write API | Mapping |
|---|---|---|---|
| Service catalogue | `GET /control/blocked_services/all` | — | Human-readable service metadata, groups, icons/IDs as defined |
| Current blocked services/schedule | `GET /control/blocked_services/get` | — | `BlockedServicesSchedule` |
| Toggle one service | Catalogue + current state | `PUT /control/blocked_services/update` | Add/remove service ID in schedule payload |
| Toggle a group | Catalogue + current state | `PUT /control/blocked_services/update` | Add/remove all group service IDs |
| Search/filter catalogue | Client-side over catalogue | — | No backend mutation |
| Set inactivity schedule | `GET /control/blocked_services/get` | `PUT /control/blocked_services/update` | Schedule fields |
| Legacy service list | Deprecated endpoints | Do not use | `/services`, `/list`, `/set` are deprecated |

Controller target:

- Fetch and cache the catalogue per compatible node/version.
- Present names/icons/groups as UI controls.
- Store canonical selected service IDs and schedule in desired state.
- Validate IDs against each node capability.
- Never ask operators to type a comma-separated or JSON array of service IDs.

## 9. DNS Rewrites mapping

| UI control | Read API | Write/action API | Mapping |
|---|---|---|---|
| Rewrite list | `GET /control/rewrite/list` | — | `RewriteList` |
| Add rewrite | — | `POST /control/rewrite/add` | `RewriteEntry` |
| Edit rewrite | — | `PUT /control/rewrite/update` | `RewriteUpdate` |
| Delete rewrite | — | `POST /control/rewrite/delete` | `RewriteEntry` |
| Rewrite settings | `GET /control/rewrite/settings` | `PUT /control/rewrite/settings/update` | `RewriteSettings` |

## 10. Query Log mapping

| UI control | Read API | Write/action API | Mapping |
|---|---|---|---|
| Query table | `GET /control/querylog` | — | `older_than` or `offset`, `limit`, `search`, `response_status` |
| Search | `GET /control/querylog` | — | `search` |
| Status filter | `GET /control/querylog` | — | `response_status` enum |
| Load older | `GET /control/querylog` | — | `older_than` |
| Query-log settings | `GET /control/querylog/config` | `PUT /control/querylog/config/update` | Current non-deprecated config API |
| Clear log | — | `POST /control/querylog_clear` | No body |

Controller extension:

- Poll each node independently.
- Deduplicate centrally.
- Add node ID to every event.
- Apply filters in the controller API across combined data.
- Preserve node-specific source metadata.

## 11. Statistics mapping

| UI control | Read API | Write/action API | Mapping |
|---|---|---|---|
| Statistics dashboard | `GET /control/stats` | — | Optional `recent` period |
| Statistics retention | `GET /control/stats/config` | `PUT /control/stats/config/update` | Retention interval |
| Reset statistics | — | `POST /control/stats_reset` | No body |

Controller extension:

- Poll snapshots.
- Avoid summing averages directly.
- Label incomplete node coverage.
- Preserve node-level breakdown.

## 12. Setup and profile mapping

| UI control | Read API | Write/action API | Mapping |
|---|---|---|---|
| Initial interface choices | `GET /control/install/get_addresses` | — | Available addresses |
| Validate setup | — | `POST /control/install/check_config` | Setup request/result |
| Apply initial setup | — | `POST /control/install/configure` | Initial configuration |
| Login | — | `POST /control/login` | Username/password |
| Logout | — | `GET /control/logout` | Session logout |
| User profile | `GET /control/profile` | `PUT /control/profile/update` | `ProfileInfo` |

Atlas DNS Controller will use its own authentication and setup APIs; these endpoints are relevant only when onboarding or managing individual AdGuard Home nodes.

## 13. Implementation classification template

Use this table when comparing the current Codex frontend:

| Feature/control | AGH UI pattern | API mapping | Current controller UI | Classification | Required action |
|---|---|---|---|---|---|
| Example: Blocked Services | Grouped searchable service toggles | `GET /blocked_services/all`, `GET /get`, `PUT /update` | Free-text IDs | Functionally correct, poor presentation | Replace with catalogue selector |

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
