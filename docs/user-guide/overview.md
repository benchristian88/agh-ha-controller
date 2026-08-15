# User Guide

Atlas DNS Controller presents one cluster at a time. The selected cluster scopes
node management, desired configuration, deployments, drift, Statistics, Query
Log, and HA operations. Browser actions always go to the controller API; the
browser never calls an AdGuard Home node directly.

## Dashboard

The Dashboard summarizes node availability, controller health, recent DNS
activity, and safety interventions. A healthy controller summary does not imply
that every node is serving DNS, and partial collector coverage is shown rather
than averaged away. Use the links on each panel for the authoritative detail.

## Statistics

Statistics aggregates supported node counters for fixed time ranges. Select the
whole cluster or one node. Coverage identifies current, stale, unsupported,
maintenance, and failed nodes. Totals are additive; percentages and latency
metrics use the relevant query/response weighting. Node-local statistics policy
is edited under General settings, while controller collection cadence is an
operator setting.

## Query Log

Query Log stores bounded, node-attributed events collected from supported node
APIs. Search by domain/client and filter by status, query type, client, or node.
Every row and detail view retains the source node. Context links can prefill an
allow/block rule, DNS rewrite, or client search, but never bypass the desired
configuration workflow.

Collection cannot recover events already removed by a node and preserves
anonymized client data as received. Coverage reports known gaps and collection
state. Treat all retained query data as sensitive.

## Settings and Filters

Settings manages shared General, DNS, Encryption inventory, Persistent Clients,
and guarded DHCP state. Filters manages blocklists, allowlists, DNS rewrites,
blocked services, and ordered custom rules.

Edits update the mutable cluster draft using optimistic concurrency. They do not
change a node immediately. Capability warnings explain values that cannot be
safely managed across all targets. TLS inventory is redacted and read-only;
private material does not enter desired state. DHCP is node-specific and permits
at most one desired active server.

## Configuration Control

Configuration Control is the publication boundary:

1. Review the draft change summary.
2. Validate every enabled target and resolve errors.
3. Publish an immutable revision.
4. Open that exact revision and review its deployment preview.
5. Confirm deployment separately.

Publication never deploys automatically. Importing a node observation replaces
the draft's managed values, so review the entire resulting draft before publish.

## Revisions and Change History

Revisions are immutable snapshots. Compare revisions, inspect their origin,
preview deployment, deploy a selected revision, or use a historical revision as
a rollback target. Change History is represented by Revisions, Deployments,
Drift, and Audit; `/ha/history` remains a compatibility redirect to Revisions.

Terminal historical revisions may be archived and shown with **Show Archived**.
Archive does not edit content or remove references. The active revision cannot
be archived. **Delete Unused Revision** is offered only when the server proves
the revision is not active, never deployed, and unreferenced; the server repeats
those checks transactionally after strong confirmation.

## Deployments

A deployment records ordered work against each target node. The worker validates
all targets before mutation, applies one node at a time, stops on the first
failure, and verifies each changed node by a fresh observation. Cancellation is
honored only at safe node boundaries. The revision becomes active only after all
targets succeed.

Terminal deployments can be archived and restored through **Show Archived**.
Completed, failed, cancelled, and interrupted history is retained. **Delete
Unstarted Deployment** applies only to a queued deployment for which no node task
started or produced an effect and no other record references it.

## Drift

Drift compares the active desired revision with fresh node observations. Manual
policy leaves resolution to the operator; Alert records a visible incident;
Enforce creates a targeted verified deployment. You can restore desired state,
adopt an observation into the draft, or place the node in maintenance. Adoption
still requires validation, publication, and deployment.

## Nodes and Node Detail

Nodes lists managed infrastructure, health, compatibility, latest observation,
and convergence. Open a node to answer: “What is this node's current operational
state, and what can I safely do next?”

Node Detail groups overview, DNS service, maintenance/DHCP, TLS, software,
collectors, and operational history. Its actions test connectivity, refresh
state, enter/return from maintenance, and coordinate guided upgrades. Links lead
to the canonical Configuration Control, Drift, Deployments, DHCP, Statistics,
Query Log, Operational Status, and Audit pages instead of duplicating them.

Maintenance preflight checks active deployments, DHCP ownership, remaining DNS
capacity, and drift. Return is fail-closed until fresh management, observation,
DNS, convergence, TLS, DHCP, and collector evidence passes, unless an explicitly
audited break-glass path applies. Nodes reloads the controller's persisted state
after either transition; if return validation fails, the node remains in
maintenance and the page shows the failure instead of treating it as a
successful exit.

## HA Operations

HA Operations presents serving capacity, DNS probe evidence, certificate and
version warnings, lifecycle event history, webhook channels, and guided upgrade
history. A guided upgrade records operator progress and validation; it never
runs host or node package commands.

Webhook endpoints are write-only secrets. The list shows only a safe
scheme/host summary. Administrators can add, edit, pause, resume, test, or delete
a channel. Editing preserves the stored destination unless **Replace destination
secret** is explicitly selected. Deletion requires the exact channel name and
retains delivery evidence with a safe channel-name snapshot.

## Operational Status

Operational Status separates API/PostgreSQL health, node reachability, complete
observation, Statistics, Query Log, background worker, retention, and storage
state. Use it when a Dashboard or feature page reports partial/stale data. Public
`/health` is liveness; `/ready` includes PostgreSQL readiness.

For recovery procedures, continue with the [operations runbook](../operations/runbook.md).
