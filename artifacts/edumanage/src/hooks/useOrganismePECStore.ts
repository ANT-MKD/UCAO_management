import { useSyncExternalStore } from "react";
import { getOrganismesPEC, subscribeOrganismesPEC } from "@/data/organismePECStore";

export function useOrganismesPEC() {
  return useSyncExternalStore(subscribeOrganismesPEC, getOrganismesPEC, getOrganismesPEC);
}
