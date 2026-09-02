import { useSyncExternalStore } from "react";
import { subscribeMotifsBlocage, getMotifsBlocage } from "@/data/motifBlocageStore";

export function useMotifsBlocage() {
  useSyncExternalStore(subscribeMotifsBlocage, getMotifsBlocage, getMotifsBlocage);
  return getMotifsBlocage();
}
