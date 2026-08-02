import { describe, expect, it } from "vitest";
import {
  hoursToSeconds,
  isObservationStale,
  secondsToHours,
  validateIPv4Configuration,
  validateStaticLease,
} from "./model";

describe("DHCP presentation validation", () => {
  it("validates subnet containment and range ordering inline", () => {
    expect(
      validateIPv4Configuration({
        gateway: "192.0.2.1",
        subnetMask: "255.255.255.0",
        rangeStart: "192.0.2.10",
        rangeEnd: "192.0.2.20",
      }),
    ).toEqual({});
    const errors = validateIPv4Configuration({
      gateway: "192.0.2.1",
      subnetMask: "255.0.255.0",
      rangeStart: "192.0.3.20",
      rangeEnd: "192.0.2.10",
    });
    expect(errors.subnetMask).toMatch(/contiguous/);
    const subnetErrors = validateIPv4Configuration({
      gateway: "192.0.2.1",
      subnetMask: "255.255.255.0",
      rangeStart: "192.0.3.20",
      rangeEnd: "192.0.2.10",
    });
    expect(subnetErrors.rangeStart).toMatch(/gateway subnet/);
    expect(subnetErrors.rangeEnd).toMatch(/before range start/);
  });

  it("converts friendly lease hours without losing seconds", () => {
    expect(hoursToSeconds(24)).toBe(86_400);
    expect(secondsToHours(86_400)).toBe(24);
    expect(hoursToSeconds(secondsToHours(90))).toBe(90);
  });

  it("validates MAC, IP, hostname, and duplicate leases", () => {
    const lease = {
      mac: "00:11:22:33:44:55",
      ip: "192.0.2.10",
      hostname: "printer",
    };
    const existing = [lease];
    expect(validateStaticLease(lease, existing, 0)).toEqual({});
    expect(
      validateStaticLease(
        { mac: "bad", ip: "300.1.1.1", hostname: "bad_host" },
        existing,
      ),
    ).toMatchObject({
      mac: expect.any(String),
      ip: expect.any(String),
      hostname: expect.any(String),
    });
    expect(
      validateStaticLease(
        { mac: "00:11:22:33:44:55", ip: "192.0.2.11", hostname: "laptop" },
        existing,
      ).mac,
    ).toMatch(/unique/);
  });

  it("classifies observation freshness", () => {
    const now = Date.parse("2026-08-02T12:00:00Z");
    expect(isObservationStale("2026-08-02T11:50:00Z", now)).toBe(false);
    expect(isObservationStale("2026-08-02T11:00:00Z", now)).toBe(true);
  });
});
