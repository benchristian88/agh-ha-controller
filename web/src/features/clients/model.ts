import {
  validateAdGuardUpstream,
  validateIdentifier,
} from "../../components/StructuredInputs";
import type { PersistentClient } from "../../lib/types";

export type ClientChangeState = "added" | "modified" | "unchanged";

export interface ClientValidation {
  name?: string;
  identifiers: string[];
  upstreams: string[];
  cacheSize?: string;
}

export function validatePersistentClient(
  client: PersistentClient,
  clients: readonly PersistentClient[],
  editingIndex?: number,
): ClientValidation {
  const name = client.name.trim();
  let nameError: string | undefined;
  if (name === "") nameError = "Enter a client name.";
  else if (
    clients.some(
      (item, index) =>
        index !== editingIndex &&
        item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  )
    nameError = "Client names must be unique.";

  const owners = new Map<string, number>();
  clients.forEach((item, index) => {
    if (index === editingIndex) return;
    item.ids.forEach((id) => {
      owners.set(id.toLocaleLowerCase(), index);
    });
  });
  const seen = new Set<string>();
  const identifierErrors = client.ids.map((identifier) => {
    const shapeError = validateIdentifier(identifier);
    if (shapeError !== undefined) return shapeError;
    const key = identifier.toLocaleLowerCase();
    if (seen.has(key)) return "This identifier is repeated in this client.";
    seen.add(key);
    return owners.has(key)
      ? "This identifier is already assigned to another client."
      : undefined;
  });
  if (client.ids.length === 0)
    identifierErrors.push("Add at least one identifier.");

  const upstreamErrors = client.upstreams
    .map((upstream, index) => validateAdGuardUpstream(upstream, index))
    .filter((issue): issue is string => issue !== undefined);
  const cacheSizeError =
    Number.isFinite(client.upstreamsCacheSize) &&
    client.upstreamsCacheSize >= 0 &&
    Number.isSafeInteger(client.upstreamsCacheSize)
      ? undefined
      : "Enter a non-negative cache size.";

  return {
    name: nameError,
    identifiers: identifierErrors.filter(
      (issue): issue is string => issue !== undefined,
    ),
    upstreams: upstreamErrors,
    cacheSize: cacheSizeError,
  };
}

export function hasClientValidationErrors(validation: ClientValidation) {
  return (
    validation.name !== undefined ||
    validation.identifiers.length > 0 ||
    validation.upstreams.length > 0 ||
    validation.cacheSize !== undefined
  );
}

export function clientMatchesSearch(client: PersistentClient, search: string) {
  const query = search.trim().toLocaleLowerCase();
  if (query === "") return true;
  return [client.name, ...client.ids, ...client.tags].some((value) =>
    value.toLocaleLowerCase().includes(query),
  );
}

export function clientChangeState(
  client: PersistentClient,
  savedClients: readonly PersistentClient[],
): ClientChangeState {
  const saved = savedClients.find(
    (item) => item.name.toLocaleLowerCase() === client.name.toLocaleLowerCase(),
  );
  if (saved === undefined) return "added";
  return JSON.stringify(saved) === JSON.stringify(client)
    ? "unchanged"
    : "modified";
}

export type CacheSizeUnit = "bytes" | "KiB" | "MiB";

const cacheSizeMultipliers: Record<CacheSizeUnit, number> = {
  bytes: 1,
  KiB: 1024,
  MiB: 1024 * 1024,
};

export function cacheSizeToBytes(value: number, unit: CacheSizeUnit) {
  return Math.round(value * cacheSizeMultipliers[unit]);
}

export function cacheSizeForDisplay(bytes: number): {
  value: number;
  unit: CacheSizeUnit;
} {
  if (bytes !== 0 && bytes % cacheSizeMultipliers.MiB === 0)
    return { value: bytes / cacheSizeMultipliers.MiB, unit: "MiB" };
  if (bytes !== 0 && bytes % cacheSizeMultipliers.KiB === 0)
    return { value: bytes / cacheSizeMultipliers.KiB, unit: "KiB" };
  return { value: bytes, unit: "bytes" };
}

export function cleanClientForDraft(
  client: PersistentClient,
): PersistentClient {
  return {
    ...client,
    name: client.name.trim(),
    ids: client.ids.map((value) => value.trim()).filter(Boolean),
    upstreams: client.upstreams.map((value) => value.trim()).filter(Boolean),
    tags: client.tags.map((value) => value.trim()).filter(Boolean),
  };
}
