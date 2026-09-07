import { useSyncExternalStore } from "react";
import { getFraisEtudiant, subscribeFraisEtudiant } from "@/data/fraisEtudiantStore";

export function useFraisEtudiant() {
  return useSyncExternalStore(subscribeFraisEtudiant, getFraisEtudiant, getFraisEtudiant);
}
