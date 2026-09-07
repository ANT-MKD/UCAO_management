import { useSyncExternalStore } from "react";
import { getReglesValidation, subscribeReglesValidation } from "@/data/reglesValidationStore";

export function useReglesValidation() {
  return useSyncExternalStore(subscribeReglesValidation, getReglesValidation, getReglesValidation);
}
