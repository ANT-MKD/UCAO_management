import { useSyncExternalStore } from "react";
import { subscribeNiveaux, getNiveaux } from "@/data/niveauStore";

export function useNiveaux() {
  return useSyncExternalStore(subscribeNiveaux, getNiveaux, getNiveaux);
}
