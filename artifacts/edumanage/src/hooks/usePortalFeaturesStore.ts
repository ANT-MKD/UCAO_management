import { useSyncExternalStore } from "react";
import { subscribePortalFeatures, getPortalFeaturesState, isFeatureActif } from "@/data/portalFeaturesStore";

export function usePortalFeatures() {
  useSyncExternalStore(subscribePortalFeatures, getPortalFeaturesState, getPortalFeaturesState);
  return getPortalFeaturesState();
}

export function useFeatureActif(featureId: string) {
  useSyncExternalStore(subscribePortalFeatures, getPortalFeaturesState, getPortalFeaturesState);
  return isFeatureActif(featureId);
}
