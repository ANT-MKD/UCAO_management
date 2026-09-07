import { useSyncExternalStore } from "react";
import { getDeliberationsAnnuelles, subscribeDeliberationsAnnuelles } from "@/data/deliberationAnnuelleStore";

export function useDeliberationsAnnuelles() {
  return useSyncExternalStore(subscribeDeliberationsAnnuelles, getDeliberationsAnnuelles, getDeliberationsAnnuelles);
}
