import { useSyncExternalStore } from "react";
import { getReglementsMasse, subscribeReglementsMasse } from "@/data/reglementMasseStore";

export function useReglementsMasse() {
  return useSyncExternalStore(subscribeReglementsMasse, getReglementsMasse, getReglementsMasse);
}
