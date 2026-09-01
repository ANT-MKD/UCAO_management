import { useSyncExternalStore } from "react";
import { getGenerations, subscribeBulletinGenerations } from "@/data/bulletinGenerationStore";

export function useBulletinGenerations() {
  return useSyncExternalStore(subscribeBulletinGenerations, getGenerations, getGenerations);
}
