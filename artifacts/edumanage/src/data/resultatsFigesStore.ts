import { ecrireStockage } from "@/lib/stockageLocal";
import type { BulletinEtudiant } from "./bulletinEngine";

const STORAGE_KEY = "edumanage-resultats-figes-v1";

/** Résultats figés à la clôture d'un jury : le bulletin de chaque étudiant, tel qu'il a été
 * délibéré. Tant que la délibération reste clôturée, relevés, bulletins et portail étudiant
 * relisent ces résultats — un changement ultérieur de formule, de réglage ou de note ne modifie
 * jamais un document déjà délivré. Rouvrir le jury libère les résultats. */
interface ResultatsSession {
  deliberationId: string;
  figeLe: string;
  bulletins: Record<string, BulletinEtudiant>;
}

const cle = (classeId: string, semestreAlias: string) => `${classeId}|${semestreAlias}`;

function load(): Record<string, ResultatsSession> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ResultatsSession>) : {};
  } catch {
    return {};
  }
}

let store: Record<string, ResultatsSession> = load();

function persist() {
  store = { ...store };
  if (typeof window !== "undefined") ecrireStockage(STORAGE_KEY, JSON.stringify(store));
}

export function figerResultats(classeId: string, semestreAlias: string, deliberationId: string, bulletins: Record<string, BulletinEtudiant>): void {
  store[cle(classeId, semestreAlias)] = { deliberationId, figeLe: new Date().toISOString(), bulletins };
  persist();
}

export function libererResultats(classeId: string, semestreAlias: string): void {
  delete store[cle(classeId, semestreAlias)];
  persist();
}

export function bulletinFige(etudiantId: string, classeId: string, semestreAlias: string): BulletinEtudiant | undefined {
  return store[cle(classeId, semestreAlias)]?.bulletins[etudiantId];
}

export function sessionFigee(classeId: string, semestreAlias: string): { figeLe: string } | undefined {
  const s = store[cle(classeId, semestreAlias)];
  return s ? { figeLe: s.figeLe } : undefined;
}
