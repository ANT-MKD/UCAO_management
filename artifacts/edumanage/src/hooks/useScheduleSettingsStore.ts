import { useSyncExternalStore } from "react";
import { typeSeanceStore, jourFerieStore } from "@/data/scheduleSettingsStore";

export function useTypesSeance() {
  return useSyncExternalStore(typeSeanceStore.subscribe, typeSeanceStore.getAll, typeSeanceStore.getAll);
}

export function useJoursFeries() {
  return useSyncExternalStore(jourFerieStore.subscribe, jourFerieStore.getAll, jourFerieStore.getAll);
}
