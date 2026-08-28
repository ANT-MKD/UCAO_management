import { useSyncExternalStore } from "react";
import { getPersonnel, subscribePersonnel } from "@/data/personnelStore";

export function usePersonnel() {
  return useSyncExternalStore(subscribePersonnel, getPersonnel, getPersonnel);
}
