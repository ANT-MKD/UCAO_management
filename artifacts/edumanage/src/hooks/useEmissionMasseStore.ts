import { useSyncExternalStore } from "react";
import { getEmissionsMasse, subscribeEmissionsMasse } from "@/data/emissionMasseStore";

export function useEmissionsMasse() {
  return useSyncExternalStore(subscribeEmissionsMasse, getEmissionsMasse, getEmissionsMasse);
}
