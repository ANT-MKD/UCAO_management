import { useSyncExternalStore } from "react";
import { getPointages, subscribePointages } from "@/data/pointageStore";

export function usePointages() {
  return useSyncExternalStore(subscribePointages, getPointages, getPointages);
}
