import { useSyncExternalStore } from "react";
import { getTeacherRates, subscribeTeacherRates } from "@/data/teacherRateStore";

export function useTeacherRates() {
  return useSyncExternalStore(subscribeTeacherRates, getTeacherRates, getTeacherRates);
}
