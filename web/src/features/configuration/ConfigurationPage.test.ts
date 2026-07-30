import { describe, expect, it } from "vitest";
import { formatValidationIssue, normaliseDraft } from "./ConfigurationPage";

describe("configuration draft response compatibility", () => {
  it("normalises the 0.2.0 null response to an absent draft", () => {
    expect(normaliseDraft(null)).toBeUndefined();
    expect(normaliseDraft(undefined)).toBeUndefined();
  });
});

describe("configuration validation guidance", () => {
  const nodes = new Map([["node-a", "Primary DNS"]]);

  it("replaces opaque node IDs with an actionable node name", () => {
    expect(
      formatValidationIssue(
        {
          field: "nodeOverrides.node-a.dnsPort",
          message: "must be between 1 and 65535",
        },
        nodes,
      ),
    ).toBe(
      "Primary DNS: DNS port is missing or invalid. Refresh and import this node's latest successful snapshot, then review the shared draft again.",
    );
    expect(
      formatValidationIssue(
        {
          field: "nodeOverrides.node-a",
          message: "is required for every enabled node",
        },
        nodes,
      ),
    ).toContain("Primary DNS: listener override is missing");
  });

  it("preserves ordinary field validation", () => {
    expect(
      formatValidationIssue(
        { field: "shared.filtering.filterUrls[0]", message: "is invalid" },
        nodes,
      ),
    ).toBe("shared.filtering.filterUrls[0]: is invalid");
  });
});
