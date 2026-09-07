import { useSyncExternalStore } from "react";
import { getDeliberations, subscribeDeliberations } from "@/data/deliberationStore";

export function useDeliberations() {
  return useSyncExternalStore(subscribeDeliberations, getDeliberations, getDeliberations);
}
