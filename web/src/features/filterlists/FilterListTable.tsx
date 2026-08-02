import { DataTable, type DataTableColumn } from "../../components/DataDisplay";
import { StatusBadge, type StatusKind } from "../../components/StatusBadge";
import type { FilterListApplicationState, FilterListRow } from "./model";

export function FilterListTable({
  rows,
  noun,
  stale,
  filtered,
  onToggle,
  onEdit,
  onRemove,
  onDetails,
}: {
  rows: readonly FilterListRow[];
  noun: string;
  stale?: boolean;
  filtered: boolean;
  onToggle: (row: FilterListRow, enabled: boolean) => void;
  onEdit: (row: FilterListRow) => void;
  onRemove: (row: FilterListRow) => void;
  onDetails: (row: FilterListRow) => void;
}) {
  const plural = `${noun}s`;
  const columns: readonly DataTableColumn<FilterListRow>[] = [
    {
      id: "enabled",
      header: "Enabled",
      render: (row) => (
        <label className="filter-list-toggle">
          <span className="visually-hidden">
            {row.desired ? "Disable" : "Enable"} {row.name}
          </span>
          <input
            type="checkbox"
            checked={row.desired}
            disabled={!row.desired && !row.portable}
            onChange={(event) => onToggle(row, event.target.checked)}
          />
        </label>
      ),
    },
    {
      id: "name",
      header: "Name",
      render: (row) => (
        <span>
          <strong>{row.mixedName ? "Mixed names" : row.name}</strong>
          {row.mixedName && (
            <span className="table-subtitle">See per-node results</span>
          )}
        </span>
      ),
    },
    {
      id: "url",
      header: "URL",
      className: "filter-list-url-column",
      render: (row) => (
        <span className="monospace filter-list-url">
          {row.url}
          {!row.portable && (
            <span className="table-subtitle">Local path · observed only</span>
          )}
        </span>
      ),
    },
    {
      id: "rules",
      header: "Rule count",
      render: (row) =>
        row.mixedRuleCount
          ? "Mixed"
          : (row.ruleCount?.toLocaleString() ?? "Not observed"),
    },
    {
      id: "updated",
      header: "Last updated",
      render: (row) =>
        row.mixedLastUpdated ? "Mixed" : formatTimestamp(row.lastUpdated),
    },
    {
      id: "draft",
      header: "Draft state",
      render: (row) => <DraftStateBadge row={row} />,
    },
    {
      id: "application",
      header: "Node application",
      render: (row) => <ApplicationBadge state={row.applicationState} />,
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="row-actions filter-list-actions">
          <button
            className="button button--quiet"
            type="button"
            onClick={() => onDetails(row)}
          >
            Per-node results
          </button>
          {row.desired && (
            <button
              className="button button--quiet"
              type="button"
              onClick={() => onEdit(row)}
            >
              Edit
            </button>
          )}
          {row.desired && (
            <button
              className="button button--danger"
              type="button"
              onClick={() => onRemove(row)}
            >
              Remove
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.key}
      caption={`DNS ${plural} in desired and observed state`}
      stale={stale}
      emptyTitle={filtered ? `No ${plural} match` : `No ${plural}`}
      emptyDescription={
        filtered
          ? "Change the search to see other subscriptions."
          : "Add an HTTP or HTTPS subscription URL to the draft."
      }
      filteredEmpty={filtered}
    />
  );
}

function DraftStateBadge({ row }: { row: FilterListRow }) {
  const values: Record<FilterListRow["draftState"], [StatusKind, string]> = {
    unchanged: ["success", "Unchanged"],
    added: ["info", "Added to draft"],
    removal_pending: ["warning", "Removal pending"],
    observed_only: ["observed", "Observed only"],
  };
  const [status, label] = values[row.draftState];
  return <StatusBadge status={status} label={label} />;
}

function ApplicationBadge({ state }: { state: FilterListApplicationState }) {
  const values: Record<FilterListApplicationState, [StatusKind, string]> = {
    applied: ["converged", "Applied on all nodes"],
    pending: ["pending", "Pending deployment"],
    mixed: ["warning", "Mixed node state"],
    disabled: ["disabled", "Disabled on nodes"],
    unavailable: ["failed", "Metadata unavailable"],
  };
  const [status, label] = values[state];
  return <StatusBadge status={status} label={label} />;
}

export function filterListNodeStatus(
  node: FilterListRow["nodes"][number],
  desired: boolean,
): StatusKind {
  if (node.status === "stale") return "stale";
  if (node.status === "unsupported") return "unsupported";
  if (node.status === "error") return "failed";
  if (desired) return node.list?.enabled ? "converged" : "pending";
  return node.list?.enabled ? "pending" : "disabled";
}

export function formatTimestamp(value?: string): string {
  if (value === undefined || value === "") return "Not observed";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Invalid node time"
    : date.toLocaleString();
}
