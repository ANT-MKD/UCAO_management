import { useSyncExternalStore } from "react";
import { subscribeAbsencesPeriode, getAbsencesPeriode } from "@/data/absencePeriodeStore";

export function useAbsencesPeriode() {
  return useSyncExternalStore(subscribeAbsencesPeriode, getAbsencesPeriode, getAbsencesPeriode);
}
