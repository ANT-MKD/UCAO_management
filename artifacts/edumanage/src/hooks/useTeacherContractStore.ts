import { useSyncExternalStore } from "react";
import { getTeacherContracts, subscribeTeacherContracts } from "@/data/teacherContractStore";

export function useTeacherContracts() {
  return useSyncExternalStore(subscribeTeacherContracts, getTeacherContracts, getTeacherContracts);
}
