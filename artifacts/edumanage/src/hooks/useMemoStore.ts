import { useSyncExternalStore } from "react";
import { subscribeMemos, getMemos } from "@/data/memoStore";

export function useMemos() {
  return useSyncExternalStore(subscribeMemos, getMemos, getMemos);
}
