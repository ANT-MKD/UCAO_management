import { useSyncExternalStore } from "react";
import { getRappelsPaiement, subscribeRappelsPaiement } from "@/data/rappelPaiementStore";

export function useRappelsPaiement() {
  return useSyncExternalStore(subscribeRappelsPaiement, getRappelsPaiement, getRappelsPaiement);
}
