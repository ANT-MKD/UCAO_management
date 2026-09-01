import { useSyncExternalStore } from "react";
import {
  subscribeCommunicationGroups,
  getGroupesExternes,
  getGroupesInternes,
  getGroupesPersonnalises,
} from "@/data/communicationGroupsStore";

export function useGroupesExternes() {
  return useSyncExternalStore(subscribeCommunicationGroups, getGroupesExternes, getGroupesExternes);
}

export function useGroupesInternes() {
  return useSyncExternalStore(subscribeCommunicationGroups, getGroupesInternes, getGroupesInternes);
}

export function useGroupesPersonnalises() {
  return useSyncExternalStore(subscribeCommunicationGroups, getGroupesPersonnalises, getGroupesPersonnalises);
}
