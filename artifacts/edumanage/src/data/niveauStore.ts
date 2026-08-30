import { NIVEAUX } from "./mockData";

export interface NiveauRecord {
  id: string;
  nom: string;
  alias: string;
  cycle: string;
  cycleId?: string;
  filiere: string;
  filiereId: string;
}

const STORAGE_KEY = "edumanage-niveau-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** NIVEAUX (data/mockData.ts) est importé et lu directement (NIVEAUX.find(...), NIVEAUX.map(...))
 * par une trentaine d'autres fichiers (finance, notes, absences, curriculum...). Ce store mute
 * donc ce même tableau en place, comme filiereStore.ts, pour que ces lectures existantes restent
 * à jour sans devoir être réécrites. Seul getNiveaux() (usage réactif) renvoie un instantané. */
const niveaux = NIVEAUX as unknown as NiveauRecord[];

function loadPersisted() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as NiveauRecord[];
    niveaux.splice(0, niveaux.length, ...saved);
  } catch {
    /* conserve le seed en cas d'erreur de lecture */
  }
}

let snapshot: NiveauRecord[] = [];

function refreshSnapshot() {
  snapshot = [...niveaux];
}

loadPersisted();
refreshSnapshot();

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(niveaux));
  }
  refreshSnapshot();
  notify();
}

export function subscribeNiveaux(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getNiveaux(): NiveauRecord[] {
  return snapshot;
}

export function getNiveauById(id: string): NiveauRecord | undefined {
  return niveaux.find((n) => n.id === id);
}

export type NiveauInput = Omit<NiveauRecord, "id">;

export function addNiveau(payload: NiveauInput): NiveauRecord {
  const record: NiveauRecord = { id: `n-${Date.now()}`, ...payload };
  niveaux.push(record);
  persist();
  return record;
}

export function updateNiveau(id: string, patch: Partial<NiveauInput>) {
  const n = niveaux.find((x) => x.id === id);
  if (!n) return;
  Object.assign(n, patch);
  persist();
}

export function deleteNiveau(id: string) {
  const idx = niveaux.findIndex((n) => n.id === id);
  if (idx >= 0) niveaux.splice(idx, 1);
  persist();
}
