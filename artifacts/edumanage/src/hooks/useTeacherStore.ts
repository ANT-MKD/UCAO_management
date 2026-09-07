import { useSyncExternalStore } from "react";
import { subscribeTeachers, getTeachers } from "@/data/teacherStore";

export function useTeachers() {
  return useSyncExternalStore(subscribeTeachers, getTeachers, getTeachers);
}
