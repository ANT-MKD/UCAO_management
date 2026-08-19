import { useSyncExternalStore } from "react";
import { subscribeStructure, getClasses, getSalles } from "@/data/structureStore";

export function useClasses() {
  return useSyncExternalStore(subscribeStructure, getClasses, getClasses);
}

export function useSalles() {
  return useSyncExternalStore(subscribeStructure, getSalles, getSalles);
}
