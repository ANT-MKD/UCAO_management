import { useSyncExternalStore } from "react";
import { getRemboursementsAvoir, subscribeRemboursementsAvoir } from "@/data/remboursementAvoirStore";

export function useRemboursementsAvoir() {
  return useSyncExternalStore(subscribeRemboursementsAvoir, getRemboursementsAvoir, getRemboursementsAvoir);
}
