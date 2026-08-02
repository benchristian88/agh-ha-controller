import type { Cluster } from "../../lib/types";
import { FilterListsPage } from "../filterlists/FilterListsPage";

export function AllowlistsPage({ cluster }: { cluster: Cluster }) {
  return <FilterListsPage cluster={cluster} kind="allowlist" />;
}
