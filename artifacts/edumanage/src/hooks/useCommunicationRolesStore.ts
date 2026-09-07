import { useSyncExternalStore } from "react";
import { subscribeCommunicationRoles, getCommunicationRoles } from "@/data/communicationRolesStore";

export function useCommunicationRoles() {
  return useSyncExternalStore(subscribeCommunicationRoles, getCommunicationRoles, getCommunicationRoles);
}
