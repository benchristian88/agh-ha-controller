import { createContext, useContext } from "react";
import type { Node } from "../lib/types";

export interface ScopeContextValue {
  nodeId: string;
  nodes: Node[];
}

const ScopeContext = createContext<ScopeContextValue>({
  nodeId: "",
  nodes: [],
});

export const ScopeProvider = ScopeContext.Provider;
export function useScope() {
  return useContext(ScopeContext);
}
