import { useSyncExternalStore } from "react";
import { subscribeEtablissement, getEtablissement } from "@/data/etablissementStore";

export function useEtablissement() {
  useSyncExternalStore(subscribeEtablissement, getEtablissement, getEtablissement);
  return getEtablissement();
}
