import { useSyncExternalStore } from "react";
import { getReductionsFrais, subscribeReductionsFrais } from "@/data/reductionFraisStore";

export function useReductionsFrais() {
  return useSyncExternalStore(subscribeReductionsFrais, getReductionsFrais, getReductionsFrais);
}
