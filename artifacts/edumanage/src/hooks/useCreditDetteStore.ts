import { useSyncExternalStore } from "react";
import { getCreditDettes, subscribeCreditDettes } from "@/data/creditDetteStore";

export function useCreditDettes() {
  return useSyncExternalStore(subscribeCreditDettes, getCreditDettes, getCreditDettes);
}
