// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DataTable, type DataTableColumn } from "./DataDisplay";

const rows = [
  { id: "one", name: "One" },
  { id: "two", name: "Two" },
];

afterEach(cleanup);

function ExpandableExample() {
  const [expanded, setExpanded] = useState("");
  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { id: "name", header: "Name", render: (row) => row.name },
    {
      id: "action",
      header: "Details",
      render: (row) => (
        <button
          type="button"
          aria-expanded={expanded === row.id}
          aria-controls={`detail-${row.id}`}
          onClick={() =>
            setExpanded((current) => (current === row.id ? "" : row.id))
          }
        >
          Toggle {row.name}
        </button>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      expandedRowKey={expanded}
      expandedRowId={(row) => `detail-${row.id}`}
      renderExpandedRow={(row) => (
        <div>
          Detail {row.name} <button type="button">Nested action</button>
        </div>
      )}
    />
  );
}

describe("expandable DataTable", () => {
  it("renders one adjacent detail row and preserves nested interactions", async () => {
    const user = userEvent.setup();
    render(<ExpandableExample />);

    const one = screen.getByRole("button", { name: "Toggle One" });
    await user.click(one);
    expect(one.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Detail One")).toBeTruthy();

    const summaryRow = one.closest("tr");
    const detailRow = summaryRow?.nextElementSibling;
    expect(detailRow?.classList.contains("table-inline-detail-row")).toBe(true);
    expect(
      within(detailRow as HTMLElement).getByRole("button", {
        name: "Nested action",
      }),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Nested action" }));
    expect(one.getAttribute("aria-expanded")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Toggle Two" }));
    expect(one.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Detail One")).toBeNull();
    expect(screen.getByText("Detail Two")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Toggle Two" }));
    expect(screen.queryByText("Detail Two")).toBeNull();
  });

  it("keeps existing non-expandable consumers unchanged", () => {
    render(
      <DataTable
        columns={[
          {
            id: "name",
            header: "Name",
            render: (row: (typeof rows)[number]) => row.name,
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
      />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});
