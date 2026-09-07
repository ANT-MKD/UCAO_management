import { useSyncExternalStore } from "react";
import { subscribeContacts, getContacts } from "@/data/contactStore";

export function useContacts() {
  return useSyncExternalStore(subscribeContacts, getContacts, getContacts);
}
