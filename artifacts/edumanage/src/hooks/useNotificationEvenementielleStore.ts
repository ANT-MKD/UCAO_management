import { useSyncExternalStore } from "react";
import { subscribeNotificationsEvenementielles, getNotificationsEvenementielles } from "@/data/notificationEvenementielleStore";

export function useNotificationsEvenementielles() {
  return useSyncExternalStore(subscribeNotificationsEvenementielles, getNotificationsEvenementielles, getNotificationsEvenementielles);
}
