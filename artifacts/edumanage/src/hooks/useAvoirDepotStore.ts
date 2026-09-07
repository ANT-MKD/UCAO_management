import { useSyncExternalStore } from "react";
import { getAvoirDepots, subscribeAvoirDepots } from "@/data/avoirDepotStore";

export function useAvoirDepots() {
  return useSyncExternalStore(subscribeAvoirDepots, getAvoirDepots, getAvoirDepots);
}
