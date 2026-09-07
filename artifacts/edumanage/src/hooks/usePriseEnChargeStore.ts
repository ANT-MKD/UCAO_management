import { useSyncExternalStore } from "react";
import { getPrisesEnCharge, subscribePrisesEnCharge } from "@/data/priseEnChargeStore";

export function usePrisesEnCharge() {
  return useSyncExternalStore(subscribePrisesEnCharge, getPrisesEnCharge, getPrisesEnCharge);
}
