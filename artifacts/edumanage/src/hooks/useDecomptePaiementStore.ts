import { useSyncExternalStore } from "react";
import { getDecomptePaiements, subscribeDecomptePaiements } from "@/data/decomptePaiementStore";

export function useDecomptePaiements() {
  return useSyncExternalStore(subscribeDecomptePaiements, getDecomptePaiements, getDecomptePaiements);
}
