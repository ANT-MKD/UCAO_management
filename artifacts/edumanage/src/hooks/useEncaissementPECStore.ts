import { useSyncExternalStore } from "react";
import { getEncaissementsPEC, subscribeEncaissementsPEC } from "@/data/encaissementPECStore";

export function useEncaissementsPEC() {
  return useSyncExternalStore(subscribeEncaissementsPEC, getEncaissementsPEC, getEncaissementsPEC);
}
