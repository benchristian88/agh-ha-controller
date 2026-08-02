import type {
  FilterListMetadata,
  FilterListPresentation,
  FilterListPresentationNode,
} from "../../lib/types";

export type FilterListDraftState =
  | "unchanged"
  | "added"
  | "removal_pending"
  | "observed_only";
export type FilterListApplicationState =
  | "applied"
  | "pending"
  | "mixed"
  | "disabled"
  | "unavailable";

export interface FilterListNodeState {
  nodeId: string;
  nodeName: string;
  status: FilterListPresentationNode["status"];
  fetchedAt?: string;
  errorCode?: string;
  list?: FilterListMetadata;
}

export interface FilterListRow {
  key: string;
  url: string;
  desired: boolean;
  active: boolean;
  portable: boolean;
  draftState: FilterListDraftState;
  applicationState: FilterListApplicationState;
  name: string;
  mixedName: boolean;
  ruleCount?: number;
  mixedRuleCount: boolean;
  lastUpdated?: string;
  mixedLastUpdated: boolean;
  nodes: FilterListNodeState[];
}

const keyForURL = (value: string) => value.trim().toLowerCase();

export function buildFilterListRows(
  desiredURLs: readonly string[],
  activeURLs: readonly string[],
  presentation?: FilterListPresentation,
): FilterListRow[] {
  const desired = new Map(desiredURLs.map((url) => [keyForURL(url), url]));
  const active = new Map(activeURLs.map((url) => [keyForURL(url), url]));
  const urls = new Map<string, string>([...desired, ...active]);
  for (const node of presentation?.nodes ?? []) {
    for (const list of node.lists) urls.set(keyForURL(list.url), list.url);
  }

  const rows = Array.from(urls, ([key, url]) => {
    const desiredURL = desired.get(key);
    const activeURL = active.get(key);
    const nodes = (presentation?.nodes ?? []).map((node) => ({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      status: node.status,
      fetchedAt: node.fetchedAt,
      errorCode: node.errorCode,
      list: node.lists.find((item) => keyForURL(item.url) === key),
    }));
    const observed = nodes.flatMap((node) =>
      node.list === undefined ? [] : [node.list],
    );
    const names = unique(observed.map((item) => item.name).filter(Boolean));
    const counts = unique(observed.map((item) => item.ruleCount));
    const updates = unique(
      observed.map((item) => item.lastUpdated).filter(isDefined),
    );
    const isDesired = desiredURL !== undefined;
    const isActive = activeURL !== undefined;
    return {
      key,
      url: desiredURL ?? activeURL ?? url,
      desired: isDesired,
      active: isActive,
      portable: observed.every((item) => item.portable),
      draftState: draftState(isDesired, isActive),
      applicationState: applicationState(isDesired, nodes),
      name: names[0] ?? fallbackName(desiredURL ?? activeURL ?? url),
      mixedName: names.length > 1,
      ruleCount: counts[0],
      mixedRuleCount: counts.length > 1,
      lastUpdated: updates[0],
      mixedLastUpdated: updates.length > 1,
      nodes,
    } satisfies FilterListRow;
  });
  return rows.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}

export function validateFilterListURL(
  raw: string,
  existingURLs: readonly string[],
  listName: string,
  previousURL?: string,
): string | undefined {
  const value = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "Enter an absolute HTTP or HTTPS URL.";
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.hostname === ""
  ) {
    return "Enter an absolute HTTP or HTTPS URL. Local file paths are not supported.";
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return "URLs containing credentials are not supported.";
  }
  const key = keyForURL(value);
  const previousKey =
    previousURL === undefined ? undefined : keyForURL(previousURL);
  if (
    key !== previousKey &&
    existingURLs.some((existing) => keyForURL(existing) === key)
  ) {
    return `This ${listName} URL is already in the draft.`;
  }
  return undefined;
}

function draftState(desired: boolean, active: boolean): FilterListDraftState {
  if (desired && active) return "unchanged";
  if (desired) return "added";
  if (active) return "removal_pending";
  return "observed_only";
}

function applicationState(
  desired: boolean,
  nodes: readonly FilterListNodeState[],
): FilterListApplicationState {
  if (nodes.length === 0) return "unavailable";
  const available = nodes.filter(
    (node) => node.status === "available" || node.status === "stale",
  );
  if (available.length === 0) return "unavailable";
  const matching = available.filter((node) =>
    desired ? node.list?.enabled === true : node.list?.enabled !== true,
  ).length;
  if (matching === available.length && available.length === nodes.length) {
    return desired ? "applied" : "disabled";
  }
  if (matching === 0 && available.length === nodes.length) return "pending";
  return "mixed";
}

function fallbackName(rawURL: string): string {
  try {
    const parsed = new URL(rawURL);
    return parsed.hostname || "New filter list";
  } catch {
    return "Observed local list";
  }
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
