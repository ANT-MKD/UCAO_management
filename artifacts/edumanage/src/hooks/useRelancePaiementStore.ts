import { useSyncExternalStore } from "react";
import { subscribeRelances, getRelances } from "@/data/relancePaiementStore";

export function useRelances() {
  return useSyncExternalStore(subscribeRelances, getRelances, getRelances);
}
