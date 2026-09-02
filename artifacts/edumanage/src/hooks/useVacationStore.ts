import { useSyncExternalStore } from "react";
import { subscribeVacations, getVacations } from "@/data/vacationStore";

export function useVacations() {
  return useSyncExternalStore(subscribeVacations, getVacations, getVacations);
}
