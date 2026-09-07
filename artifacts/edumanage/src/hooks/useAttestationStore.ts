import { useSyncExternalStore } from "react";
import { getAttestations, subscribeAttestations } from "@/data/attestationStore";

export function useAttestations() {
  return useSyncExternalStore(subscribeAttestations, getAttestations, getAttestations);
}
