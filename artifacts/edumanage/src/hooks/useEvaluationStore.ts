import { useSyncExternalStore } from "react";
import { subscribeEvaluation, getEvaluations } from "@/data/evaluationStore";

export function useEvaluations() {
  return useSyncExternalStore(subscribeEvaluation, getEvaluations, getEvaluations);
}
