import type { BlocklistPresentation } from "../../lib/types";
import {
  buildFilterListRows,
  type FilterListApplicationState,
  type FilterListRow,
  validateFilterListURL,
} from "../filterlists/model";

export type BlocklistApplicationState = FilterListApplicationState;
export type BlocklistRow = FilterListRow;

export function buildBlocklistRows(
  desiredURLs: readonly string[],
  activeURLs: readonly string[],
  presentation?: BlocklistPresentation,
): BlocklistRow[] {
  return buildFilterListRows(desiredURLs, activeURLs, presentation);
}

export function validateBlocklistURL(
  raw: string,
  existingURLs: readonly string[],
  previousURL?: string,
): string | undefined {
  return validateFilterListURL(raw, existingURLs, "blocklist", previousURL);
}
