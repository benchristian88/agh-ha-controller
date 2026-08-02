import { describe, expect, it } from "vitest";
import type { Rewrite } from "../../lib/types";
import {
  cleanRewriteForDraft,
  hasRewriteValidationErrors,
  inferRewriteType,
  rewriteChangeState,
  rewriteMatchesSearch,
  validateRewrite,
} from "./model";

const existing: Rewrite[] = [
  { domain: "router.test", answer: "192.0.2.1", enabled: true },
  { domain: "*.service.test", answer: "target.test", enabled: true },
];

describe("DNS rewrite presentation model", () => {
  const routerRewrite = existing[0];
  const wildcardRewrite = existing[1];
  if (routerRewrite === undefined || wildcardRewrite === undefined)
    throw new Error("Rewrite fixtures are incomplete");

  it.each([
    ["router.test", "192.0.2.1", "A"],
    ["router.test", "2001:db8::1", "AAAA"],
    ["alias.test", "target.test", "CNAME"],
    ["pass.test", "pass.test", "CNAME exception"],
    ["router.test", "A", "A passthrough"],
    ["router.test", "AAAA", "AAAA passthrough"],
  ] as const)("infers %s -> %s as %s", (domain, answer, expected) => {
    expect(inferRewriteType({ domain, answer })).toBe(expected);
  });

  it.each([
    { domain: "host.test", answer: "198.51.100.4", enabled: true },
    { domain: "host.test", answer: "2001:db8::4", enabled: true },
    { domain: "*.host.test", answer: "alias.test", enabled: true },
    { domain: "host.test", answer: "A", enabled: true },
    { domain: "host.test", answer: "AAAA", enabled: true },
  ])("accepts supported rewrite $domain -> $answer", (rewrite) => {
    expect(validateRewrite(rewrite, [])).toEqual({});
  });

  it.each([
    "",
    "https://host.test",
    "host.test/path",
    "host.test:53",
    "_service._tcp.test",
    "host..test",
    "host.test.",
    "*host.test",
    "host.*.test",
  ])("rejects invalid domain or wildcard %s", (domain) => {
    const validation = validateRewrite(
      { domain, answer: "192.0.2.1", enabled: true },
      [],
    );
    expect(validation.domain).toBeDefined();
    expect(hasRewriteValidationErrors(validation)).toBe(true);
  });

  it.each([
    "",
    "999.1.1.1",
    "192.0.2.0/24",
    "https://target.test",
    "*.target.test",
    "target test",
    "NOERROR;A;192.0.2.1",
  ])("rejects unsupported answer %s", (answer) => {
    expect(
      validateRewrite({ domain: "host.test", answer, enabled: true }, [])
        .answer,
    ).toBeDefined();
  });

  it("detects duplicate pairs case-insensitively but permits another answer", () => {
    expect(
      validateRewrite(
        { domain: "ROUTER.TEST", answer: "192.0.2.1", enabled: true },
        existing,
      ).duplicate,
    ).toBe("This domain and answer pair already exists in the draft.");
    expect(
      validateRewrite(
        { domain: "router.test", answer: "192.0.2.2", enabled: true },
        existing,
      ).duplicate,
    ).toBeUndefined();
  });

  it("excludes the edited row from duplicate detection", () => {
    expect(validateRewrite(routerRewrite, existing, 0)).toEqual({});
  });

  it("searches domain and answer without case sensitivity", () => {
    expect(rewriteMatchesSearch(wildcardRewrite, "SERVICE")).toBe(true);
    expect(rewriteMatchesSearch(wildcardRewrite, "target")).toBe(true);
    expect(rewriteMatchesSearch(wildcardRewrite, "missing")).toBe(false);
  });

  it("cleans only surrounding whitespace and reports row change state", () => {
    const cleaned = cleanRewriteForDraft({
      domain: " Router.Test ",
      answer: " 192.0.2.1 ",
      enabled: true,
    });
    expect(cleaned).toEqual({
      domain: "Router.Test",
      answer: "192.0.2.1",
      enabled: true,
    });
    expect(rewriteChangeState(routerRewrite, 0, existing)).toBe("unchanged");
    expect(
      rewriteChangeState({ ...routerRewrite, enabled: false }, 0, existing),
    ).toBe("modified");
    expect(
      rewriteChangeState(wildcardRewrite, 0, existing, [wildcardRewrite]),
    ).toBe("unchanged");
    const added = { domain: "new.test", answer: "192.0.2.8", enabled: true };
    expect(
      rewriteChangeState(added, 1, existing, [wildcardRewrite, added]),
    ).toBe("added");
  });
});
