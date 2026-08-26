import { useSyncExternalStore } from "react";
import { getTeacherVolumes, subscribeTeacherVolumes } from "@/data/teacherVolumeStore";

export function useTeacherVolumes() {
  return useSyncExternalStore(subscribeTeacherVolumes, getTeacherVolumes, getTeacherVolumes);
}
