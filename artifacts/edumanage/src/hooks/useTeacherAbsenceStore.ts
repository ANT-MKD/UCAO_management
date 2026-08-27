import { useSyncExternalStore } from "react";
import { getTeacherAbsences, subscribeTeacherAbsences } from "@/data/teacherAbsenceStore";

export function useTeacherAbsences() {
  return useSyncExternalStore(subscribeTeacherAbsences, getTeacherAbsences, getTeacherAbsences);
}
