import { useSyncExternalStore } from "react";
import { subscribeAbandons, getAbandons } from "@/data/abandonStore";

export function useAbandons() {
  return useSyncExternalStore(subscribeAbandons, getAbandons, getAbandons);
}
