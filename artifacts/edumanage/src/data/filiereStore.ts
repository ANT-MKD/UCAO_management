import { FILIERES } from "./mockData";

export interface FiliereRecord {
  id: string;
  code: string;
  nom: string;
  responsable: string;
  responsableId?: string;
  nbClasses: number;
  nbEtudiants: number;
  statut: "actif" | "inactif";
  cycleId?: string;
  cycle?: string;
  entiteId?: string;
  entite?: string;
  typeProgramme?: "semestriel" | "annuel";
  anneesActives?: string[];
  specialite?: string;
  informationsComplementaires?: string;
}

const STORAGE_KEY = "edumanage-filiere-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** FILIERES (data/mockData.ts) est importé et lu directement (FILIERES.find(...)) par une
 * cinquantaine d'autres fichiers (finance, notes, bulletins, évaluations, inscriptions...).
 * Ce store mute donc ce même tableau en place (push/splice/Object.assign) plutôt que d'en
 * tenir une copie séparée, pour que ces lectures existantes restent à jour sans devoir être
 * réécrites. Seul getFilieres() (usage réactif) renvoie un instantané figé séparément. */
const filieres = FILIERES as unknown as FiliereRecord[];

function loadPersisted() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as FiliereRecord[];
    filieres.splice(0, filieres.length, ...saved);
  } catch {
    /* conserve le seed en cas d'erreur de lecture */
  }
}

let snapshot: FiliereRecord[] = [];

function refreshSnapshot() {
  snapshot = [...filieres];
}

loadPersisted();
refreshSnapshot();

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filieres));
  }
  refreshSnapshot();
  notify();
}

export function subscribeFilieres(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getFilieres(): FiliereRecord[] {
  return snapshot;
}

export function getFiliereById(id: string): FiliereRecord | undefined {
  return filieres.find((f) => f.id === id);
}

export function getFiliereByCode(code: string): FiliereRecord | undefined {
  return filieres.find((f) => f.code === code);
}

export type FiliereInput = Omit<FiliereRecord, "id">;

export function addFiliere(payload: FiliereInput): FiliereRecord {
  const record: FiliereRecord = { id: `f-${Date.now()}`, ...payload };
  filieres.push(record);
  persist();
  return record;
}

export function updateFiliere(id: string, patch: Partial<FiliereInput>) {
  const f = filieres.find((x) => x.id === id);
  if (!f) return;
  Object.assign(f, patch);
  persist();
}

export function deleteFiliere(id: string) {
  const idx = filieres.findIndex((f) => f.id === id);
  if (idx >= 0) filieres.splice(idx, 1);
  persist();
}
