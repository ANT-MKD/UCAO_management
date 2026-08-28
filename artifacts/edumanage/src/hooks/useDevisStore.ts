import { useSyncExternalStore } from "react";
import { getDevis, subscribeDevis } from "@/data/devisStore";

export function useDevisList() {
  return useSyncExternalStore(subscribeDevis, getDevis, getDevis);
}
