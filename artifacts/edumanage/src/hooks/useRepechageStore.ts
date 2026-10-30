import { useSyncExternalStore } from "react";
import { getRepechages, subscribeRepechages } from "@/data/repechageStore";

export function useRepechages() {
  return useSyncExternalStore(subscribeRepechages, getRepechages, getRepechages);
}
