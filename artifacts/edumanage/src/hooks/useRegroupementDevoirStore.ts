import { useSyncExternalStore } from "react";
import { getRegroupementsDevoir, subscribeRegroupementsDevoir } from "@/data/regroupementDevoirStore";

export function useRegroupementsDevoir() {
  return useSyncExternalStore(subscribeRegroupementsDevoir, getRegroupementsDevoir, getRegroupementsDevoir);
}
