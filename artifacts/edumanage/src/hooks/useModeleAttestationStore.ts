import { useSyncExternalStore } from "react";
import { getModelesAttestations, subscribeModelesAttestations } from "@/data/modeleAttestationStore";

export function useModelesAttestations() {
  useSyncExternalStore(subscribeModelesAttestations, getModelesAttestations, getModelesAttestations);
  return getModelesAttestations();
}
