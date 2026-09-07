import { useSyncExternalStore } from "react";
import { subscribePortefeuilleCours, getPortefeuilleCours } from "@/data/portefeuilleCoursStore";

export function usePortefeuilleCours() {
  return useSyncExternalStore(subscribePortefeuilleCours, getPortefeuilleCours, getPortefeuilleCours);
}
