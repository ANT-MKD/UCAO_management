import { useSyncExternalStore } from "react";
import { subscribePortalAccess, getPortalAccess } from "@/data/portalAccessStore";

export function usePortalAccess() {
  return useSyncExternalStore(subscribePortalAccess, getPortalAccess, getPortalAccess);
}
