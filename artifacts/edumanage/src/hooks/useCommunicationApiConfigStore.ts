import { useSyncExternalStore } from "react";
import { subscribeCommunicationApiUrl, getCommunicationApiUrl } from "@/data/communicationApiConfigStore";

export function useCommunicationApiUrl() {
  return useSyncExternalStore(subscribeCommunicationApiUrl, getCommunicationApiUrl, getCommunicationApiUrl);
}
