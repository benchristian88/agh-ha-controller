import { describe, expect, it } from "vitest";
import { ruleProposalFromSearch } from "../filters/CustomRulesPage";
import { rewriteProposalFromSearch } from "../rewrites/RewritesPage";

describe("Query Log contextual action proposals", () => {
  it("creates explicit allow and block draft rules", () => {
    expect(ruleProposalFromSearch("?action=allow&domain=Example.ORG")).toEqual({
      action: "allow",
      rule: "@@||example.org^",
    });
    expect(
      ruleProposalFromSearch("?action=block&domain=ads.example.org"),
    ).toEqual({ action: "block", rule: "||ads.example.org^" });
  });

  it("rejects unsafe domains and unrelated actions", () => {
    expect(
      ruleProposalFromSearch("?action=block&domain=https://example.org/x"),
    ).toBeUndefined();
    expect(
      rewriteProposalFromSearch("?action=delete&domain=example.org"),
    ).toBeUndefined();
  });

  it("prefills only the domain for the validated rewrite workflow", () => {
    expect(
      rewriteProposalFromSearch("?action=create&domain=Router.Example"),
    ).toEqual({
      mode: "add",
      rewrite: { domain: "router.example", answer: "", enabled: true },
    });
  });
});
