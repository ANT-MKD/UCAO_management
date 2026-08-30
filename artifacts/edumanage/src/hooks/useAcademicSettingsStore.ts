import { useSyncExternalStore } from "react";
import { cycleStore, entiteStore, categorieCoursStore } from "@/data/academicSettingsStore";

export function useCycles() {
  return useSyncExternalStore(cycleStore.subscribe, cycleStore.getAll, cycleStore.getAll);
}

export function useEntites() {
  return useSyncExternalStore(entiteStore.subscribe, entiteStore.getAll, entiteStore.getAll);
}

export function useCategoriesCours() {
  return useSyncExternalStore(categorieCoursStore.subscribe, categorieCoursStore.getAll, categorieCoursStore.getAll);
}
