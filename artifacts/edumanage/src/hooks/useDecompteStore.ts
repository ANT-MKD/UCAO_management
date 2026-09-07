import { useSyncExternalStore } from "react";
import { getDecomptes, subscribeDecomptes } from "@/data/decompteStore";

export function useDecomptes() {
  return useSyncExternalStore(subscribeDecomptes, getDecomptes, getDecomptes);
}
