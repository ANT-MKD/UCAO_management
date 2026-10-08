import { useSyncExternalStore } from "react";
import { getDemandesCorrection, subscribeDemandesCorrection } from "@/data/correctionNoteStore";

export function useDemandesCorrection() {
  return useSyncExternalStore(subscribeDemandesCorrection, getDemandesCorrection, getDemandesCorrection);
}
