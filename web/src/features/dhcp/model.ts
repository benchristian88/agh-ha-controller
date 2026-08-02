import type { DhcpStaticLease } from "../../lib/types";

export interface IPv4Validation {
  gateway?: string;
  subnetMask?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

export function hoursToSeconds(hours: number): number {
  return Math.round(hours * 3_600);
}

export function secondsToHours(seconds: number): number {
  return seconds / 3_600;
}

export function validateIPv4Configuration(value: {
  gateway: string;
  subnetMask: string;
  rangeStart: string;
  rangeEnd: string;
}): IPv4Validation {
  const errors: IPv4Validation = {};
  const gateway = ipv4Number(value.gateway);
  const mask = ipv4Number(value.subnetMask);
  const start = ipv4Number(value.rangeStart);
  const end = ipv4Number(value.rangeEnd);
  if (gateway === undefined) errors.gateway = "Enter a valid IPv4 gateway.";
  if (mask === undefined || !isContiguousMask(mask))
    errors.subnetMask = "Enter a contiguous IPv4 subnet mask.";
  if (start === undefined) errors.rangeStart = "Enter a valid IPv4 address.";
  if (end === undefined) errors.rangeEnd = "Enter a valid IPv4 address.";
  if (Object.keys(errors).length > 0) return errors;
  if (end !== undefined && start !== undefined && end < start)
    errors.rangeEnd = "Range end must not be before range start.";
  if (
    gateway !== undefined &&
    mask !== undefined &&
    start !== undefined &&
    (gateway & mask) !== (start & mask)
  )
    errors.rangeStart = "Range start must be inside the gateway subnet.";
  if (
    gateway !== undefined &&
    mask !== undefined &&
    end !== undefined &&
    (gateway & mask) !== (end & mask)
  )
    errors.rangeEnd = "Range end must be inside the gateway subnet.";
  return errors;
}

export function validateStaticLease(
  lease: DhcpStaticLease,
  leases: readonly DhcpStaticLease[],
  editingIndex?: number,
): Partial<Record<keyof DhcpStaticLease, string>> {
  const errors: Partial<Record<keyof DhcpStaticLease, string>> = {};
  const mac = lease.mac.trim().toLowerCase();
  const ip = lease.ip.trim();
  const hostname = lease.hostname.trim();
  if (!/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(mac))
    errors.mac = "Enter a six-byte MAC address.";
  if (!isIPAddress(ip)) errors.ip = "Enter a valid IPv4 or IPv6 address.";
  if (!isHostname(hostname))
    errors.hostname =
      "Use valid hostname labels with letters, digits, and hyphens.";
  leases.forEach((current, index) => {
    if (index === editingIndex) return;
    if (current.mac.trim().toLowerCase() === mac)
      errors.mac = "MAC address must be unique on this node.";
    if (current.ip.trim() === ip)
      errors.ip = "IP address must be unique on this node.";
  });
  return errors;
}

export function isObservationStale(
  observedAt: string,
  now = Date.now(),
  thresholdMs = 15 * 60_000,
): boolean {
  const value = Date.parse(observedAt);
  return Number.isNaN(value) || now - value > thresholdMs;
}

function ipv4Number(value: string): number | undefined {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return undefined;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return undefined;
    const octet = Number(part);
    if (octet > 255) return undefined;
    result = result * 256 + octet;
  }
  return result >>> 0;
}

function isContiguousMask(mask: number): boolean {
  return /^1*0*$/.test((mask >>> 0).toString(2).padStart(32, "0"));
}

function isIPAddress(value: string): boolean {
  return ipv4Number(value) !== undefined || isIPv6(value);
}

function isIPv6(value: string): boolean {
  if (value === "" || !/^[0-9a-f:]+$/i.test(value)) return false;
  if ((value.match(/::/g) ?? []).length > 1) return false;
  const sides = value.split("::");
  const groups = sides.flatMap((side) => (side === "" ? [] : side.split(":")));
  if (groups.some((group) => group.length < 1 || group.length > 4))
    return false;
  return sides.length === 2 ? groups.length < 8 : groups.length === 8;
}

function isHostname(value: string): boolean {
  if (value.length < 1 || value.length > 253) return false;
  return value
    .split(".")
    .every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    );
}
