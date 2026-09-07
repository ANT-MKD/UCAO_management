import { useSyncExternalStore } from "react";
import { subscribePublicites, getPublicites } from "@/data/publiciteStore";

export function usePublicites() {
  return useSyncExternalStore(subscribePublicites, getPublicites, getPublicites);
}
