import { useSyncExternalStore } from "react";
import { subscribeDocuments, getDocuments } from "@/data/documentStore";

export function useDocuments() {
  return useSyncExternalStore(subscribeDocuments, getDocuments, getDocuments);
}
