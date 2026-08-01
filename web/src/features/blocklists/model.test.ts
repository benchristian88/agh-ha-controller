import { describe, expect, it } from "vitest";
import type { BlocklistPresentation } from "../../lib/types";
import { buildBlocklistRows, validateBlocklistURL } from "./model";

const presentation: BlocklistPresentation = {
  generatedAt: "2026-08-01T00:00:00Z",
  stale: false,
  partial: false,
  nodes: [
    {
      nodeId: "node-a",
      nodeName: "Primary",
      status: "available",
      lists: [
        {
          id: 1,
          url: "https://filters.test/list.txt",
          name: "Primary name",
          enabled: true,
          ruleCount: 100,
          lastUpdated: "2026-08-01T00:00:00Z",
          portable: true,
        },
      ],
    },
    {
      nodeId: "node-b",
      nodeName: "Secondary",
      status: "available",
      lists: [
        {
          id: 9,
          url: "https://filters.test/list.txt",
          name: "Secondary name",
          enabled: false,
          ruleCount: 101,
          lastUpdated: "2026-07-31T00:00:00Z",
          portable: true,
        },
      ],
    },
  ],
};

describe("blocklist presentation model", () => {
  it("migrates desired URL values into rows while keeping mixed metadata observed-only", () => {
    const rows = buildBlocklistRows(
      ["https://filters.test/list.txt"],
      ["https://filters.test/list.txt"],
      presentation,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      desired: true,
      draftState: "unchanged",
      applicationState: "mixed",
      mixedName: true,
      mixedRuleCount: true,
      mixedLastUpdated: true,
    });
    expect(rows[0]?.nodes).toHaveLength(2);
  });

  it("shows URL replacement as add plus disable-oriented removal", () => {
    const rows = buildBlocklistRows(
      ["https://filters.test/new.txt"],
      ["https://filters.test/old.txt"],
    );
    expect(rows.map((row) => row.draftState).sort()).toEqual([
      "added",
      "removal_pending",
    ]);
  });

  it.each([
    ["/opt/adguard/list.txt", "HTTP or HTTPS"],
    ["ftp://filters.test/list.txt", "HTTP or HTTPS"],
    ["https://user:secret@filters.test/list.txt", "credentials"],
    ["not a URL", "HTTP or HTTPS"],
  ])("rejects unsupported URL %s", (value, message) => {
    expect(validateBlocklistURL(value, [])).toContain(message);
  });

  it("accepts a unique portable URL and rejects a duplicate", () => {
    expect(
      validateBlocklistURL("https://filters.test/list.txt", []),
    ).toBeUndefined();
    expect(
      validateBlocklistURL("HTTPS://FILTERS.TEST/list.txt", [
        "https://filters.test/list.txt",
      ]),
    ).toContain("already");
  });
});
