import { describe, expect, it } from "vitest";
import { formatTimeOfDay, parseTimeOfDay } from "./settings";

describe("managed settings input conversion", () => {
  it("round-trips minute-aligned schedule times", () => {
    expect(formatTimeOfDay(parseTimeOfDay("13:45"))).toBe("13:45");
  });

  it("formats the last selectable minute of a day", () => {
    expect(formatTimeOfDay(86_340_000)).toBe("23:59");
  });
});
