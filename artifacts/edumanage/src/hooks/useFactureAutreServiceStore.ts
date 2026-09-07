import { useSyncExternalStore } from "react";
import { getFacturesAutreService, subscribeFacturesAutreService } from "@/data/factureAutreServiceStore";

export function useFacturesAutreService() {
  return useSyncExternalStore(subscribeFacturesAutreService, getFacturesAutreService, getFacturesAutreService);
}
