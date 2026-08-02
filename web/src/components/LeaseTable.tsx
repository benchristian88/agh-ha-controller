import type { ReactNode } from "react";
import { DataTable, type DataTableColumn } from "./DataDisplay";

export interface LeaseTableRow {
  id: string;
  client: string;
  address: string;
  mac: string;
  node: string;
  expiry?: ReactNode;
  observation?: ReactNode;
  actions?: ReactNode;
}

export function LeaseTable({
  rows,
  caption,
  observed = false,
  stale = false,
  emptyTitle,
  emptyDescription,
}: {
  rows: readonly LeaseTableRow[];
  caption: string;
  observed?: boolean;
  stale?: boolean;
  emptyTitle: string;
  emptyDescription: ReactNode;
}) {
  const columns: DataTableColumn<LeaseTableRow>[] = [
    { id: "client", header: "Client / hostname", render: (row) => row.client },
    {
      id: "address",
      header: "Address",
      render: (row) => <span className="monospace">{row.address}</span>,
    },
    {
      id: "mac",
      header: "MAC",
      render: (row) => <span className="monospace">{row.mac || "—"}</span>,
    },
    { id: "node", header: "Node", render: (row) => row.node },
  ];
  if (observed) {
    columns.push(
      { id: "expiry", header: "Expiry", render: (row) => row.expiry ?? "—" },
      {
        id: "observation",
        header: "Observation",
        render: (row) => row.observation ?? "—",
      },
    );
  } else {
    columns.push({
      id: "actions",
      header: "Actions",
      render: (row) => row.actions,
      align: "right",
    });
  }
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      caption={caption}
      stale={stale}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    />
  );
}
