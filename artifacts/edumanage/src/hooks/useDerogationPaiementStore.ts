import { useSyncExternalStore } from "react";
import { getDerogationsPaiement, subscribeDerogationsPaiement } from "@/data/derogationPaiementStore";

export function useDerogationsPaiement() {
  return useSyncExternalStore(subscribeDerogationsPaiement, getDerogationsPaiement, getDerogationsPaiement);
}
