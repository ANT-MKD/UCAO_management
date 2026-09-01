import { useSyncExternalStore } from "react";
import { getTypesEvaluation, subscribeTypesEvaluation } from "@/data/typeEvaluationStore";

export function useTypesEvaluation() {
  return useSyncExternalStore(subscribeTypesEvaluation, getTypesEvaluation, getTypesEvaluation);
}
