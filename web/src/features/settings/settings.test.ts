import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createEditorRowKey,
  formatTimeOfDay,
  parseTimeOfDay,
} from "./settings";

afterEach(() => vi.unstubAllGlobals());

describe("managed settings input conversion", () => {
  it("round-trips minute-aligned schedule times", () => {
    expect(formatTimeOfDay(parseTimeOfDay("13:45"))).toBe("13:45");
  });

  it("formats the last selectable minute of a day", () => {
    expect(formatTimeOfDay(86_340_000)).toBe("23:59");
  });

  it("creates unique editor row keys without secure-context browser APIs", () => {
    vi.stubGlobal("crypto", {});

    const first = createEditorRowKey("rewrite");
    const second = createEditorRowKey("rewrite");

    expect(first).toMatch(/^rewrite-\d+$/);
    expect(second).toMatch(/^rewrite-\d+$/);
    expect(second).not.toBe(first);
  });
});
