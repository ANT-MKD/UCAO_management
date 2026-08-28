import { useSyncExternalStore } from "react";
import { getExportsComptables, subscribeExportsComptables } from "@/data/exportComptableStore";

export function useExportsComptables() {
  return useSyncExternalStore(subscribeExportsComptables, getExportsComptables, getExportsComptables);
}
