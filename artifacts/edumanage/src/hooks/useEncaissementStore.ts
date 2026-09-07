import { useSyncExternalStore } from "react";
import { getEncaissements, subscribeEncaissements } from "@/data/encaissementStore";

export function useEncaissements() {
  return useSyncExternalStore(subscribeEncaissements, getEncaissements, getEncaissements);
}
