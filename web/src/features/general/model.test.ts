import { describe, expect, it } from "vitest";
import {
  DAY_MILLIS,
  HOUR_MILLIS,
  POLICY_CUSTOM_UNITS,
  validPolicyDuration,
} from "./model";

describe("General Settings duration model", () => {
  it("keeps preset and custom duration multipliers exact", () => {
    expect(7 * DAY_MILLIS).toBe(604_800_000);
    expect(13 * HOUR_MILLIS).toBe(46_800_000);
    expect(POLICY_CUSTOM_UNITS.at(-1)?.multiplier).toBe(1);
  });

  it("accepts unknown in-range millisecond values without rounding", () => {
    const unknown = HOUR_MILLIS + 1;
    expect(validPolicyDuration(unknown, true)).toBe(true);
    const preciseUnit = POLICY_CUSTOM_UNITS.at(-1);
    expect(preciseUnit).toBeDefined();
    expect(unknown / (preciseUnit?.multiplier ?? Number.NaN)).toBe(unknown);
  });

  it("requires retention when a policy is enabled", () => {
    expect(validPolicyDuration(0, false)).toBe(true);
    expect(validPolicyDuration(0, true)).toBe(false);
    expect(validPolicyDuration(HOUR_MILLIS, true)).toBe(true);
  });
});
