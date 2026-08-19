import { useSyncExternalStore } from "react";
import { subscribeCurriculum, getUes, getEcs } from "@/data/curriculumStore";

export function useUes() {
  return useSyncExternalStore(subscribeCurriculum, getUes, getUes);
}

export function useEcs() {
  return useSyncExternalStore(subscribeCurriculum, getEcs, getEcs);
}
