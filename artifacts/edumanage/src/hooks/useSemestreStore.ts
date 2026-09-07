import { useSyncExternalStore } from "react";
import { subscribeSemestres, getSemestres } from "@/data/semestreStore";

export function useSemestres() {
  return useSyncExternalStore(subscribeSemestres, getSemestres, getSemestres);
}
