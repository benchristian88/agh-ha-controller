import type {
  DurationCustomUnit,
  DurationPreset,
} from "../../components/StructuredInputs";

export const HOUR_MILLIS = 3_600_000;
export const DAY_MILLIS = 24 * HOUR_MILLIS;
export const YEAR_MILLIS = 365 * DAY_MILLIS;

export const FILTER_UPDATE_PRESETS: readonly DurationPreset[] = [
  { label: "Disabled", value: 0 },
  { label: "Every hour", value: 1 },
  { label: "Every 12 hours", value: 12 },
  { label: "Every day", value: 24 },
  { label: "Every 3 days", value: 72 },
  { label: "Every week", value: 168 },
];

export const POLICY_DURATION_PRESETS: readonly DurationPreset[] = [
  { label: "Disabled retention", value: 0 },
  { label: "1 day", value: DAY_MILLIS },
  { label: "7 days", value: 7 * DAY_MILLIS },
  { label: "30 days", value: 30 * DAY_MILLIS },
  { label: "90 days", value: 90 * DAY_MILLIS },
  { label: "1 year", value: YEAR_MILLIS },
];

// Ordered from most readable to most precise. DurationField selects the first
// unit that represents an imported value exactly and falls back to milliseconds.
export const POLICY_CUSTOM_UNITS: readonly DurationCustomUnit[] = [
  { label: "days", multiplier: DAY_MILLIS },
  { label: "hours", multiplier: HOUR_MILLIS },
  { label: "minutes", multiplier: 60_000 },
  { label: "seconds", multiplier: 1_000 },
  { label: "milliseconds", multiplier: 1 },
];

export const SAFE_SEARCH_PROVIDERS = [
  { key: "bing", label: "Bing" },
  { key: "duckDuckGo", label: "DuckDuckGo" },
  { key: "ecosia", label: "Ecosia", capability: "safe_search_ecosia" },
  { key: "google", label: "Google" },
  { key: "pixabay", label: "Pixabay" },
  { key: "yandex", label: "Yandex" },
  { key: "youTube", label: "YouTube" },
] as const;

export function validPolicyDuration(value: number, enabled: boolean) {
  if (!Number.isInteger(value)) return false;
  if (value === 0) return !enabled;
  return value >= HOUR_MILLIS && value <= YEAR_MILLIS;
}
