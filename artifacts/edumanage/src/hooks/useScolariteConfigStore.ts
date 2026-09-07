import { useSyncExternalStore } from "react";
import { getScolariteConfigs, getValeursParDefaut, subscribeScolariteConfigs } from "@/data/scolariteConfigStore";

export function useScolariteConfigs() {
  return useSyncExternalStore(subscribeScolariteConfigs, getScolariteConfigs, getScolariteConfigs);
}

export function useValeursParDefautScolarite() {
  return useSyncExternalStore(subscribeScolariteConfigs, getValeursParDefaut, getValeursParDefaut);
}
