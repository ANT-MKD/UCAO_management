import { useSyncExternalStore } from "react";
import { subscribeEvenements, getEvenements } from "@/data/evenementStore";

export function useEvenements() {
  return useSyncExternalStore(subscribeEvenements, getEvenements, getEvenements);
}
