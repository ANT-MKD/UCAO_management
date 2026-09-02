import { useSyncExternalStore } from "react";
import { subscribeSignatureConfig, getSignatureConfigState } from "@/data/signatureConfigStore";

export function useSignatureConfigs() {
  useSyncExternalStore(subscribeSignatureConfig, getSignatureConfigState, getSignatureConfigState);
  return getSignatureConfigState();
}
