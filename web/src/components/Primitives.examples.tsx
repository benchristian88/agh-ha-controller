import { useState } from "react";
import {
  ConvergenceSummary,
  DataTable,
  NodeBadge,
  Pagination,
  PartialSuccessPanel,
  ProgressTimeline,
  RevisionBadge,
  StructuredDiff,
} from "./DataDisplay";
import {
  Banner,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Toast,
} from "./Feedback";
import { ConfirmDialog, Dialog, OperationalCommandDialog } from "./Overlays";
import { PageContainer, PageHeader } from "./Page";
import {
  CapabilityWarning,
  Field,
  ScopeIndicator,
  SettingRow,
  SettingsGroup,
  UnsavedChangesNotice,
} from "./Settings";
import { StatusBadge } from "./StatusBadge";
import {
  DomainListField,
  DurationField,
  IdentifierListEditor,
  NetworkListField,
  RuleEditor,
  UpstreamEditor,
  UrlListField,
} from "./StructuredInputs";

/**
 * In-repository equivalent of a Storybook showcase. It is intentionally not
 * routed into production navigation; visual tooling can render this export.
 */
export function SharedPrimitivesShowcase() {
  return (
    <div className="primitive-showcase">
      <PrimitiveThemeExample theme="light" viewport="desktop" />
      <PrimitiveThemeExample theme="dark" viewport="desktop" />
      <PrimitiveThemeExample theme="light" viewport="mobile" />
      <StateExamples />
      <OverlayExamples />
    </div>
  );
}

function PrimitiveThemeExample({
  theme,
  viewport,
}: {
  theme: "light" | "dark";
  viewport: "desktop" | "mobile";
}) {
  const [networks, setNetworks] = useState(["192.0.2.0/24"]);
  const [domains, setDomains] = useState(["example.org"]);
  const [urls, setUrls] = useState(["https://example.org/filter.txt"]);
  const [identifiers, setIdentifiers] = useState(["00:11:22:33:44:55"]);
  const [rules, setRules] = useState(["||example.org^"]);
  const [upstreams, setUpstreams] = useState(["https://dns.example/dns-query"]);
  const [duration, setDuration] = useState(24);
  return (
    <section
      data-theme={theme}
      data-viewport={viewport}
      className="primitive-example"
    >
      <PageContainer size={viewport === "mobile" ? "narrow" : "wide"}>
        <PageHeader
          eyebrow={`${theme} · ${viewport}`}
          title="Shared primitives"
          description="Semantic, responsive, controlled components."
          primaryAction={
            <button className="button" type="button">
              Primary action
            </button>
          }
          secondaryActions={
            <button className="button button--secondary" type="button">
              Secondary
            </button>
          }
          statusNotice={<StatusBadge status="converged" />}
        />
        <SettingsGroup
          title="DNS policy"
          description="Entire-cluster desired state"
        >
          <SettingRow
            title="Protection"
            description="Enable DNS protection on managed nodes."
            control={
              <input aria-label="Protection" type="checkbox" defaultChecked />
            }
            status={<ScopeIndicator scope="cluster" />}
          />
          <Field
            label="Resolver mode"
            htmlFor={`${theme}-${viewport}-mode`}
            scope={<ScopeIndicator scope="cluster" />}
          >
            <select id={`${theme}-${viewport}-mode`} defaultValue="parallel">
              <option value="parallel">Parallel</option>
            </select>
          </Field>
          <DurationField
            label="Refresh interval"
            value={duration}
            unit="hours"
            presets={[
              { label: "Every 12 hours", value: 12 },
              { label: "Daily", value: 24 },
            ]}
            onChange={setDuration}
          />
          <NetworkListField
            label="Allowed networks"
            value={networks}
            onChange={setNetworks}
          />
          <DomainListField
            label="Ignored domains"
            value={domains}
            onChange={setDomains}
          />
          <UrlListField label="Subscriptions" value={urls} onChange={setUrls} />
          <IdentifierListEditor
            label="Client identifiers"
            value={identifiers}
            onChange={setIdentifiers}
          />
          <RuleEditor label="Rules" value={rules} onChange={setRules} />
          <UpstreamEditor
            label="Upstreams"
            value={upstreams}
            onChange={setUpstreams}
          />
        </SettingsGroup>
        <UnsavedChangesNotice dirty />
        <div className="badge-example">
          <StatusBadge status="healthy" />
          <StatusBadge status="drifted" />
          <NodeBadge name="Primary DNS" status="healthy" />
          <RevisionBadge number={24} active />
        </div>
        <ConvergenceSummary
          counts={{ converged: 2, pending: 0, drifted: 0, failed: 0 }}
        />
      </PageContainer>
    </section>
  );
}

function StateExamples() {
  return (
    <section className="primitive-example" data-theme="dark">
      <Banner tone="warning" title="Stale data">
        Last successful node observation is being shown.
      </Banner>
      <CapabilityWarning state="unsupported">
        The selected node version does not support this setting.
      </CapabilityWarning>
      <Toast tone="success" message="Draft saved" />
      <LoadingSkeleton label="Loading example" />
      <EmptyState title="No results" filtered>
        <p>Change the current filters.</p>
      </EmptyState>
      <ErrorState error={new Error("Example failure state")} />
      <DataTable
        columns={[
          {
            id: "name",
            header: "Node",
            render: (row: { id: string; name: string }) => row.name,
          },
        ]}
        rows={[{ id: "a", name: "Primary DNS" }]}
        rowKey={(row) => row.id}
        stale
        pagination={
          <Pagination
            page={1}
            pageCount={2}
            onPrevious={() => undefined}
            onNext={() => undefined}
          />
        }
      />
      <StructuredDiff
        differences={[
          {
            id: "dns",
            section: "DNS",
            field: "protection",
            before: false,
            after: true,
            summary: "Protection enabled",
          },
        ]}
      />
      <ProgressTimeline
        steps={[
          { id: "queued", label: "Queued", status: "success" },
          { id: "apply", label: "Apply to secondary", status: "applying" },
          { id: "verify", label: "Verify", status: "pending" },
        ]}
      />
      <PartialSuccessPanel
        results={[
          { id: "one", label: "Primary DNS", status: "success" },
          {
            id: "two",
            label: "Secondary DNS",
            status: "failed",
            message: "Node unreachable",
          },
        ]}
      />
    </section>
  );
}

function OverlayExamples() {
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [command, setCommand] = useState(false);
  return (
    <section className="primitive-example" data-theme="light">
      <div className="row-actions row-actions--start">
        <button
          type="button"
          className="button"
          onClick={() => setDialog(true)}
        >
          Open dialog
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={() => setConfirm(true)}
        >
          Open confirmation
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setCommand(true)}
        >
          Open command
        </button>
      </div>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Edit shared setting"
        actions={
          <button
            className="button"
            type="button"
            onClick={() => setDialog(false)}
          >
            Done
          </button>
        }
      >
        <p>Dialog example.</p>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => setConfirm(false)}
        title="Remove item?"
        confirmationText="remove"
      />
      <OperationalCommandDialog
        open={command}
        onClose={() => setCommand(false)}
        onConfirm={() => setCommand(false)}
        command="Refresh filters"
        scope="Entire Cluster"
        impact="Each enabled node will be contacted."
      />
    </section>
  );
}
