import { useSyncExternalStore } from "react";
import { getGrillesFrais, subscribeGrillesFrais } from "@/data/grilleFraisStore";

export function useGrillesFrais() {
  return useSyncExternalStore(subscribeGrillesFrais, getGrillesFrais, getGrillesFrais);
}
