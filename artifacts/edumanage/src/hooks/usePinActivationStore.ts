import { useSyncExternalStore } from "react";
import { subscribePinActivation, getPinsActivation } from "@/data/pinActivationStore";

export function usePinsActivation() {
  return useSyncExternalStore(subscribePinActivation, getPinsActivation, getPinsActivation);
}
