import { describe, expect, it } from "vitest";
import { validateIdentifier } from "../../components/StructuredInputs";
import type { PersistentClient } from "../../lib/types";
import {
  cacheSizeForDisplay,
  cacheSizeToBytes,
  cleanClientForDraft,
  clientMatchesSearch,
  hasClientValidationErrors,
  validatePersistentClient,
} from "./model";

function client(patch: Partial<PersistentClient> = {}): PersistentClient {
  return {
    name: "Printer",
    ids: ["192.0.2.10"],
    useGlobalSettings: true,
    filteringEnabled: true,
    parentalEnabled: false,
    safeBrowsingEnabled: false,
    safeSearch: {
      enabled: false,
      bing: true,
      duckDuckGo: true,
      ecosia: true,
      google: true,
      pixabay: true,
      yandex: true,
      youTube: true,
    },
    useGlobalBlockedServices: true,
    blockedServices: ["legacy-service"],
    blockedServicesSchedule: { timeZone: "Local", days: {} },
    upstreams: [],
    upstreamsCacheEnabled: false,
    upstreamsCacheSize: 0,
    tags: ["device_printer"],
    ignoreQueryLog: false,
    ignoreStatistics: false,
    ...patch,
  };
}

describe("persistent client presentation model", () => {
  it("searches by name, identifier, and tag", () => {
    const value = client();
    expect(clientMatchesSearch(value, "print")).toBe(true);
    expect(clientMatchesSearch(value, "192.0.2")).toBe(true);
    expect(clientMatchesSearch(value, "DEVICE_PRINTER")).toBe(true);
    expect(clientMatchesSearch(value, "phone")).toBe(false);
  });

  it("validates unique names and identifiers across clients", () => {
    const existing = client();
    const candidate = client({ name: "printer", ids: ["192.0.2.10"] });
    const validation = validatePersistentClient(candidate, [existing]);
    expect(validation.name).toBe("Client names must be unique.");
    expect(validation.identifiers).toContain(
      "This identifier is already assigned to another client.",
    );
    expect(hasClientValidationErrors(validation)).toBe(true);
  });

  it.each([
    "192.0.2.1",
    "2001:db8::1",
    "192.0.2.0/24",
    "2001:db8::/64",
    "00:11:22:33:44:55",
    "client-id_01",
  ])("accepts supported identifier form %s", (identifier) => {
    expect(validateIdentifier(identifier)).toBeUndefined();
  });

  it.each(["999.1.1.1", "192.0.2.0/99", "00:11:22:33:44", "bad id"])(
    "rejects malformed identifier %s",
    (identifier) => {
      expect(validateIdentifier(identifier)).toMatch(/valid|prefix/);
    },
  );

  it("preserves upstream ordering, case, unknown tags, and service IDs", () => {
    const cleaned = cleanClientForDraft(
      client({
        upstreams: [" tls://DNS.Example ", "1.1.1.1", ""],
        tags: [" Legacy_Tag "],
        blockedServices: ["unknown-Service"],
      }),
    );
    expect(cleaned.upstreams).toEqual(["tls://DNS.Example", "1.1.1.1"]);
    expect(cleaned.tags).toEqual(["Legacy_Tag"]);
    expect(cleaned.blockedServices).toEqual(["unknown-Service"]);
  });

  it("converts cache sizes without losing bytes", () => {
    expect(cacheSizeToBytes(4, "MiB")).toBe(4_194_304);
    expect(cacheSizeForDisplay(4_194_304)).toEqual({
      value: 4,
      unit: "MiB",
    });
    expect(cacheSizeForDisplay(1537)).toEqual({ value: 1537, unit: "bytes" });
  });

  it("reports specialised upstream syntax errors without rewriting entries", () => {
    const validation = validatePersistentClient(
      client({
        upstreams: ["1.1.1.1", "[/example.org/]", "tls://dns.example"],
      }),
      [],
    );
    expect(validation.upstreams).toEqual([
      "Upstream 2 needs a resolver or # after its selector.",
    ]);
  });
});
