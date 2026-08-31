import { useMemo, useSyncExternalStore } from "react";
import { getMethodesCalcul, subscribeBulletinMethodes, type NiveauMethodeCalcul } from "@/data/bulletinMethodesStore";

export function useMethodesCalcul() {
  return useSyncExternalStore(subscribeBulletinMethodes, getMethodesCalcul, getMethodesCalcul);
}

/** Dérive la liste filtrée par niveau via useMemo plutôt qu'un getSnapshot séparé : `.filter()`
 * alloue un nouveau tableau à chaque appel, ce qui ferait boucler useSyncExternalStore (son
 * getSnapshot doit renvoyer une référence stable tant que le store n'a pas changé). */
export function useMethodesCalculParNiveau(niveau: NiveauMethodeCalcul) {
  const methodes = useMethodesCalcul();
  return useMemo(() => methodes.filter((m) => m.niveau === niveau), [methodes, niveau]);
}
