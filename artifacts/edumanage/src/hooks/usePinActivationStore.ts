import { useSyncExternalStore } from "react";
import { subscribePinActivation, getPinsActivation, getDemandesReinitialisation } from "@/data/pinActivationStore";

export function usePinsActivation() {
  return useSyncExternalStore(subscribePinActivation, getPinsActivation, getPinsActivation);
}

export function useDemandesReinitialisation() {
  return useSyncExternalStore(subscribePinActivation, getDemandesReinitialisation, getDemandesReinitialisation);
}
