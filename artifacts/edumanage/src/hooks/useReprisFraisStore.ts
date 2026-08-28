import { useSyncExternalStore } from "react";
import { getReprisFrais, subscribeReprisFrais } from "@/data/reprisFraisStore";

export function useReprisFrais() {
  return useSyncExternalStore(subscribeReprisFrais, getReprisFrais, getReprisFrais);
}
