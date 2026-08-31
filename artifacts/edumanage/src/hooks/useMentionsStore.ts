import { useSyncExternalStore } from "react";
import { getMentions, subscribeMentions } from "@/data/mentionsStore";

export function useMentions() {
  return useSyncExternalStore(subscribeMentions, getMentions, getMentions);
}
