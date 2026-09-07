import { useSyncExternalStore } from "react";
import { subscribeMailsEnvoyes, getMailsEnvoyes } from "@/data/mailEnvoyeStore";

export function useMailsEnvoyes() {
  return useSyncExternalStore(subscribeMailsEnvoyes, getMailsEnvoyes, getMailsEnvoyes);
}
