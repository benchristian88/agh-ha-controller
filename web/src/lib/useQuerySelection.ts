import { useCallback, useEffect, useRef, useState } from "react";

export function useQuerySelection(parameter: string) {
  const read = useCallback(
    () => new URLSearchParams(window.location.search).get(parameter) ?? "",
    [parameter],
  );
  const [selectedID, setSelectedID] = useState(read);
  const scrolledIDs = useRef(new Set<string>());

  useEffect(() => {
    const handlePopState = () => setSelectedID(read());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [read]);

  const select = useCallback(
    (id: string, options?: { replace?: boolean }) => {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set(parameter, id);
      else url.searchParams.delete(parameter);
      const method = options?.replace ? "replaceState" : "pushState";
      window.history[method](
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
      setSelectedID(id);
    },
    [parameter],
  );

  const toggle = useCallback(
    (id: string) => select(selectedID === id ? "" : id),
    [select, selectedID],
  );

  const scrollIntoViewOnce = useCallback((id: string, elementID: string) => {
    if (!id || scrolledIDs.current.has(id)) return;
    const element = document.getElementById(elementID);
    if (!element) return;
    scrolledIDs.current.add(id);
    element.scrollIntoView?.({ block: "nearest" });
  }, []);

  return { selectedID, select, toggle, scrollIntoViewOnce };
}
