import { useSyncExternalStore } from "react";
import { subscribePaiementsDeclares, getPaiementsDeclares } from "@/data/paiementDeclareStore";

export function usePaiementsDeclares() {
  return useSyncExternalStore(subscribePaiementsDeclares, getPaiementsDeclares, getPaiementsDeclares);
}
