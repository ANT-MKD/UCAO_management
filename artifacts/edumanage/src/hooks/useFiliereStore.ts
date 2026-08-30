import { useSyncExternalStore } from "react";
import { subscribeFilieres, getFilieres } from "@/data/filiereStore";

export function useFilieres() {
  return useSyncExternalStore(subscribeFilieres, getFilieres, getFilieres);
}
