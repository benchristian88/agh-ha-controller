import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banner,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/Feedback";
import { PageContainer, PageHeader } from "../../components/Page";
import { ScheduleEditor } from "../../components/ScheduleEditor";
import {
  CapabilityWarning,
  ScopeIndicator,
  SettingsGroup,
  UnsavedChangesNotice,
} from "../../components/Settings";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import type {
  BlockedServicesCatalogue,
  Cluster,
  ConfigurationDraft,
  ConfigurationRevision,
  Node,
  ValidationIssue,
} from "../../lib/types";
import { ServiceCatalogue } from "./ServiceCatalogue";

export function BlockedServicesPage({ cluster }: { cluster: Cluster }) {
  const [draft, setDraft] = useState<ConfigurationDraft>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [revisions, setRevisions] = useState<ConfigurationRevision[]>([]);
  const [catalogue, setCatalogue] = useState<BlockedServicesCatalogue>();
  const [savedDocument, setSavedDocument] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inventory, nodeResult, revisionResult, catalogueResult] =
        await Promise.all([
          api.configurationInventory(cluster.id),
          api.nodes(cluster.id),
          api.configurationRevisions(cluster.id),
          api.blockedServicesCatalogue(cluster.id),
        ]);
      setDraft(inventory.draft);
      setSavedDocument(
        inventory.draft ? JSON.stringify(inventory.draft.document) : "",
      );
      setNodes(nodeResult.items);
      setRevisions(revisionResult.items);
      setCatalogue(catalogueResult);
      setIssues([]);
      setSaved(false);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [cluster.id]);

  useEffect(() => void load(), [load]);

  const activeRevision = revisions.find(
    (revision) => revision.active || revision.id === cluster.activeRevisionId,
  );
  const affectedNodes = nodes.filter((node) => node.enabled);
  const dirty =
    draft !== undefined && JSON.stringify(draft.document) !== savedDocument;
  const selectedIDs = draft?.document.shared.services.blockedServiceIds ?? [];
  const scheduleIssues = issues
    .filter((issue) =>
      issue.field.startsWith("shared.services.blockedSchedule"),
    )
    .map((issue) => `${issue.field}: ${issue.message}`);
  const compatibilityIssues = useMemo(() => {
    if (catalogue === undefined) return [];
    const selected = new Set(selectedIDs);
    return catalogue.services.filter(
      (service) =>
        selected.has(service.id) && service.unsupportedNodeIds.length > 0,
    );
  }, [catalogue, selectedIDs]);
  const unavailableNodes =
    catalogue?.nodes.filter((node) => node.status !== "available") ?? [];

  const updateServices = (
    patch: Partial<ConfigurationDraft["document"]["shared"]["services"]>,
  ) => {
    if (draft === undefined) return;
    setSaved(false);
    setDraft({
      ...draft,
      document: {
        ...draft.document,
        shared: {
          ...draft.document.shared,
          services: { ...draft.document.shared.services, ...patch },
        },
      },
    });
  };

  async function saveDraft() {
    if (draft === undefined) return;
    setSaving(true);
    setSaved(false);
    try {
      const result = await api.updateConfigurationDraft(
        cluster.id,
        draft.version,
        draft.document,
      );
      setDraft(result.draft);
      setSavedDocument(JSON.stringify(result.draft.document));
      setIssues(result.issues);
      setSaved(true);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  if (loading && draft === undefined) {
    return (
      <PageContainer size="wide">
        <PageHeader title="Blocked Services" />
        <LoadingSkeleton label="Loading blocked-services catalogue" rows={8} />
      </PageContainer>
    );
  }
  if (error !== undefined && draft === undefined) {
    return (
      <PageContainer size="wide">
        <PageHeader title="Blocked Services" />
        <ErrorState error={error} retry={() => void load()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Filters"
        title="Blocked Services"
        description="Selected services are blocked across the cluster after the draft is published and deployed."
        primaryAction={
          <button
            type="button"
            className="button"
            disabled={draft === undefined || saving}
            onClick={() => void saveDraft()}
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>
        }
      />

      {error !== undefined && (
        <Banner tone="danger" title="The latest request failed">
          {error instanceof Error ? error.message : "Something went wrong."}
        </Banner>
      )}
      {draft === undefined ? (
        <EmptyState title="Import a node configuration first">
          <p>
            Open Configuration Control, refresh a node, and import its
            observation to create the cluster draft.
          </p>
        </EmptyState>
      ) : draft.document.schemaVersion !== 2 ? (
        <Banner tone="danger" title="Unsupported draft format">
          Import a current schema-v2 observation before editing blocked
          services.
        </Banner>
      ) : (
        <>
          <UnsavedChangesNotice
            dirty={dirty}
            saving={saving}
            saved={saved}
            onSave={() => void saveDraft()}
          />

          <SettingsGroup title="Scope and state">
            <dl className="blocked-services-state">
              <div>
                <dt>Scope</dt>
                <dd>
                  <ScopeIndicator scope="cluster" />
                </dd>
              </div>
              <div>
                <dt>Current draft</dt>
                <dd>Version {draft.version}</dd>
              </div>
              <div>
                <dt>Active revision</dt>
                <dd>
                  {activeRevision
                    ? `Revision #${activeRevision.revisionNumber}`
                    : "None"}
                </dd>
              </div>
              <div>
                <dt>Affected nodes</dt>
                <dd>{affectedNodes.length}</dd>
              </div>
            </dl>
            {affectedNodes.length > 0 && (
              <ul
                className="blocked-services-node-list"
                aria-label="Affected nodes"
              >
                {affectedNodes.map((node) => (
                  <li className="entity-badge entity-badge--node" key={node.id}>
                    <span aria-hidden="true">●</span>
                    {node.name}
                  </li>
                ))}
              </ul>
            )}
          </SettingsGroup>

          {catalogue?.stale && (
            <CapabilityWarning state="stale">
              Cached catalogue metadata is visible, but publication requires a
              current catalogue from every enabled node.
            </CapabilityWarning>
          )}
          {(catalogue?.partial || unavailableNodes.length > 0) && (
            <CapabilityWarning
              state="partial"
              title="Some node catalogues are unavailable"
            >
              <ul className="compact-list">
                {unavailableNodes.map((node) => (
                  <li key={node.nodeId}>
                    {node.nodeName}: {node.status}
                    {node.errorCode ? ` (${node.errorCode})` : ""}
                  </li>
                ))}
              </ul>
            </CapabilityWarning>
          )}
          {compatibilityIssues.length > 0 && (
            <CapabilityWarning
              state="unsupported"
              title="Selected services are not cluster-compatible"
            >
              Publication preflight will reject these IDs until every enabled
              node supports them. No selection will be removed automatically.
            </CapabilityWarning>
          )}

          <SettingsGroup
            title="Service catalogue"
            description="Choose named services from the catalogues reported by your AdGuard Home nodes."
            actions={
              <StatusBadge
                status={catalogue?.partial ? "warning" : "success"}
                label={catalogue?.partial ? "Partial" : "Current"}
              />
            }
          >
            {catalogue === undefined ? (
              <LoadingSkeleton
                label="Loading service catalogue"
                rows={6}
                compact
              />
            ) : catalogue.services.length === 0 &&
              selectedIDs.length === 0 &&
              unavailableNodes.length === 0 ? (
              <EmptyState title="No services are available">
                <p>
                  The enabled nodes returned an empty blocked-services
                  catalogue.
                </p>
              </EmptyState>
            ) : (
              <ServiceCatalogue
                catalogue={catalogue}
                selectedIDs={selectedIDs}
                onChange={(blockedServiceIds) =>
                  updateServices({ blockedServiceIds })
                }
              />
            )}
          </SettingsGroup>

          <SettingsGroup
            title="Inactivity schedule"
            description="Selected periods temporarily stop blocked-service filtering. Existing time-zone and seven-day semantics are preserved."
          >
            <ScheduleEditor
              label="Blocked-services inactivity schedule"
              value={draft.document.shared.services.blockedSchedule}
              errors={scheduleIssues}
              onChange={(blockedSchedule) =>
                updateServices({ blockedSchedule })
              }
            />
          </SettingsGroup>

          {issues.filter(
            (issue) =>
              !issue.field.startsWith("shared.services.blockedSchedule"),
          ).length > 0 && (
            <Banner tone="warning" title="Validation needs attention">
              <ul className="compact-list">
                {issues
                  .filter(
                    (issue) =>
                      !issue.field.startsWith(
                        "shared.services.blockedSchedule",
                      ),
                  )
                  .map((issue) => (
                    <li key={`${issue.field}-${issue.message}`}>
                      {issue.message}
                    </li>
                  ))}
              </ul>
            </Banner>
          )}
        </>
      )}
    </PageContainer>
  );
}
