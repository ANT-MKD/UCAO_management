import { useSyncExternalStore } from "react";
import { getDeclassementParametres, subscribeDeclassementParametres } from "@/data/declassementParametreStore";

export function useDeclassementParametres() {
  return useSyncExternalStore(subscribeDeclassementParametres, getDeclassementParametres, getDeclassementParametres);
}
