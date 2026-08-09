import { useCallback, useEffect, useState } from "react";
import { ErrorState, Loading } from "../../components/Feedback";
import { PageContainer, PageHeader } from "../../components/Page";
import { api } from "../../lib/api";
import type { Cluster } from "../../lib/types";

type Step = { label: string; complete: boolean; href: string; action: string };
export function SetupGuidePage({ cluster }: { cluster: Cluster }) {
  const [steps, setSteps] = useState<Step[]>();
  const [error, setError] = useState<unknown>();
  const load = useCallback(async () => {
    try {
      const [
        nodes,
        inventory,
        revisions,
        deployments,
        statistics,
        queries,
        health,
        operational,
      ] = await Promise.allSettled([
        api.nodes(cluster.id),
        api.configurationInventory(cluster.id),
        api.configurationRevisions(cluster.id),
        api.deployments(cluster.id),
        api.statistics(cluster.id, "24h"),
        api.queryEvents(cluster.id, { limit: 1 }),
        api.haStatus(cluster.id),
        api.operationalStatus(cluster.id),
      ]);
      const nodeItems = nodes.status === "fulfilled" ? nodes.value.items : [];
      const draft =
        inventory.status === "fulfilled" ? inventory.value.draft : undefined;
      const revisionItems =
        revisions.status === "fulfilled" ? revisions.value.items : [];
      const deploymentItems =
        deployments.status === "fulfilled" ? deployments.value.items : [];
      setSteps([
        {
          label: "Administrator configured",
          complete: true,
          href: "/system/users",
          action: "Manage administrators",
        },
        {
          label: "First AdGuard Home node added",
          complete: nodeItems.filter((node) => node.enabled).length >= 1,
          href: "/ha/nodes",
          action: "Add first node",
        },
        {
          label: "Redundant node added",
          complete: nodeItems.filter((node) => node.enabled).length >= 2,
          href: "/ha/nodes",
          action: "Add redundant node",
        },
        {
          label: "Configuration observed",
          complete:
            inventory.status === "fulfilled" &&
            inventory.value.snapshots.length > 0,
          href: "/ha/configuration",
          action: "Observe configuration",
        },
        {
          label: "Desired draft adopted",
          complete: draft !== undefined,
          href: "/ha/configuration",
          action: "Import desired state",
        },
        {
          label: "Immutable revision published",
          complete: revisionItems.length > 0,
          href: "/ha/revisions",
          action: "Validate and publish",
        },
        {
          label: "Active revision deployed",
          complete:
            revisionItems.some((revision) => revision.active) &&
            deploymentItems.some(
              (deployment) => deployment.status === "succeeded",
            ),
          href: "/ha/deployments",
          action: "Deploy revision",
        },
        {
          label: "Statistics current",
          complete:
            statistics.status === "fulfilled" &&
            statistics.value.totals.dnsQueries > 0,
          href: "/statistics",
          action: "Check Statistics",
        },
        {
          label: "Query Log current",
          complete:
            queries.status === "fulfilled" && queries.value.items.length > 0,
          href: "/query-log",
          action: "Check Query Log",
        },
        {
          label: "HA/DNS health available",
          complete:
            health.status === "fulfilled" && health.value.nodes.length > 0,
          href: "/ha/operations",
          action: "Check HA Operations",
        },
        {
          label: "Operational Status available",
          complete: operational.status === "fulfilled",
          href: "/system/operational-status",
          action: "Open Operational Status",
        },
      ]);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, [cluster.id]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <PageContainer size="standard">
      <PageHeader
        eyebrow="Getting started"
        title="Setup Guide"
        description="Completion is derived from controller state, not page visits."
      />
      {error !== undefined && (
        <ErrorState error={error} retry={() => void load()} />
      )}
      {!steps && !error && <Loading label="Checking setup progress…" />}
      <ol className="setup-guide">
        {steps?.map((step) => (
          <li
            key={step.label}
            className={step.complete ? "setup-guide__complete" : ""}
          >
            <span aria-hidden="true">{step.complete ? "✓" : "○"}</span>
            <div>
              <span className="sr-only">
                {step.complete ? "Complete: " : "Incomplete: "}
              </span>
              <strong>{step.label}</strong>
              <br />
              <a href={step.href}>{step.action}</a>
            </div>
          </li>
        ))}
      </ol>
    </PageContainer>
  );
}
