# HA Operations and Lifecycle

Release 0.8 adds operational coordination without placing Atlas in the live DNS
path. The existing node health worker still measures authenticated AdGuard Home
API reachability. A separate worker sends a real DNS query to each enabled,
non-maintenance node every 30 seconds, using the node URL host and last observed
DNS port by default. Operators can override the host, port, name, expected
response code, and UDP/TCP protocols per node. The default root `NS` query
expects `NOERROR`. Each network operation has a two-second bound.

The latest result and 30 days of probe evidence are durable. Only transitions
produce HA events, which are retained for one year. A result is healthy only
when every enabled protocol succeeds. The cluster is `healthy` with at least
two fresh serving nodes and no other operational degradation, `degraded` while
DNS redundancy remains but API/convergence/maintenance needs attention, and
`at_risk` with fewer than two verified serving nodes. This calculation supports
N nodes and does not assume a primary/secondary pair.

Maintenance preflight blocks active deployments and an observed active DHCP
owner. Open drift remains visible. Removing the last verified DNS node requires
the exact break-glass confirmation. Maintenance excludes the node from ordinary
polling, deployment, and reconciliation and suppresses its expected DNS-failure
notifications. Returning to service runs fresh API, capability/configuration,
DNS, active-revision convergence, drift, DHCP, TLS, and configured-collector
checks. Any required failure keeps maintenance enabled.

Certificate state comes from redacted observation metadata. Thresholds are 30
days for warning and seven days for critical; expired is separate. Certificate
material and filesystem paths never enter this model.

The upstream release checker reads the official AdGuard Home GitHub latest
release endpoint at most every six hours and stores a safe cache. Failure keeps
the previous version and marks it stale. Atlas compatibility remains derived
from its explicit adapter profile rather than inferred from the upstream tag.

Native/systemd and Docker nodes receive a durable guided upgrade workflow. The
operator performs the platform-specific install or container replacement;
Atlas accepts only a target inside its explicit tested adapter range, then
validates the freshly reported target version and the complete
return-to-service sequence. Other installation types are explicitly
unsupported. Failed validation records safe evidence and leaves the node in
maintenance. There is no remote shell, unattended upgrade, or claimed rollback
in Release 0.8.

Webhook delivery is optional. HTTPS destinations are AES-256-GCM encrypted and
write-only. Payloads contain the event ID/type/severity/summary/time and node ID
when applicable. Delivery retries are bounded to five attempts and use stable
error codes; disabling a channel stops pending delivery.
