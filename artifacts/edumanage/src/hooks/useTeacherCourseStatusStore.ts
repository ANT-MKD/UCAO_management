import { useSyncExternalStore } from "react";
import {
  getTeacherCourseStatuses,
  subscribeTeacherCourseStatus,
} from "@/data/teacherCourseStatusStore";

export function useTeacherCourseStatuses() {
  return useSyncExternalStore(
    subscribeTeacherCourseStatus,
    getTeacherCourseStatuses,
    getTeacherCourseStatuses,
  );
}
