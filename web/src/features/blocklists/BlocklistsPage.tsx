import type { Cluster } from "../../lib/types";
import { FilterListsPage } from "../filterlists/FilterListsPage";

export function BlocklistsPage({ cluster }: { cluster: Cluster }) {
  return <FilterListsPage cluster={cluster} kind="blocklist" />;
}
