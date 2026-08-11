import { vi } from "vitest";

export function installMatchMedia(matches = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => listeners.add(listener),
    removeEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => listeners.delete(listener),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  } as MediaQueryList;

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );

  return {
    setMatches(next: boolean) {
      Object.defineProperty(query, "matches", {
        configurable: true,
        value: next,
      });
      const event = {
        matches: next,
        media: query.media,
      } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    },
  };
}
