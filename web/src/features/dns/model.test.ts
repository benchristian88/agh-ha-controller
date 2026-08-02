import { describe, expect, it } from "vitest";
import {
  cacheSizeForDisplay,
  cacheSizeToBytes,
  validateIp,
  validateIpFamily,
  validCacheSize,
  validWholeSeconds,
} from "./model";

describe("DNS presentation conversions", () => {
  it("converts cache sizes exactly and preserves unusual byte values", () => {
    expect(cacheSizeToBytes(4, "MiB")).toBe(4_194_304);
    expect(cacheSizeToBytes(3, "KiB")).toBe(3_072);
    expect(cacheSizeForDisplay(4_194_304)).toEqual({ value: 4, unit: "MiB" });
    expect(cacheSizeForDisplay(3_072)).toEqual({ value: 3, unit: "KiB" });
    expect(cacheSizeForDisplay(1_537)).toEqual({
      value: 1_537,
      unit: "bytes",
    });
  });

  it("requires exact non-negative schema units", () => {
    expect(validCacheSize(0, false)).toBe(true);
    expect(validCacheSize(0, true)).toBe(false);
    expect(validCacheSize(1.5, true)).toBe(false);
    expect(validWholeSeconds(3600)).toBe(true);
    expect(validWholeSeconds(0.5)).toBe(false);
  });

  it("validates address families without accepting CIDR", () => {
    expect(validateIpFamily("192.0.2.1", 4)).toBeUndefined();
    expect(validateIpFamily("2001:db8::1", 6)).toBeUndefined();
    expect(validateIpFamily("2001:db8::1", 4)).toMatch(/IPv4/);
    expect(validateIp("192.0.2.0/24")).toBeDefined();
  });
});
