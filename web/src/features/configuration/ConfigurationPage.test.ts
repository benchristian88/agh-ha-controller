import { describe, expect, it } from "vitest";
import { normaliseDraft } from "./ConfigurationPage";

describe("configuration draft response compatibility", () => {
  it("normalises the 0.2.0 null response to an absent draft", () => {
    expect(normaliseDraft(null)).toBeUndefined();
    expect(normaliseDraft(undefined)).toBeUndefined();
  });
});
