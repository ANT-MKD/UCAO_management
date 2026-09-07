import { useSyncExternalStore } from "react";
import { getPECsMasse, subscribePECsMasse } from "@/data/pecMasseStore";

export function usePECsMasse() {
  return useSyncExternalStore(subscribePECsMasse, getPECsMasse, getPECsMasse);
}
