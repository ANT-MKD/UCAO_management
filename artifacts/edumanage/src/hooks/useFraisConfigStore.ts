import { useSyncExternalStore } from "react";
import { getFraisConfigs, subscribeFraisConfigs } from "@/data/fraisConfigStore";

export function useFraisConfigs() {
  return useSyncExternalStore(subscribeFraisConfigs, getFraisConfigs, getFraisConfigs);
}
