import { useSyncExternalStore } from "react";
import { getRallonges, subscribeRallonges } from "@/data/rallongeStore";

export function useRallonges() {
  return useSyncExternalStore(subscribeRallonges, getRallonges, getRallonges);
}
