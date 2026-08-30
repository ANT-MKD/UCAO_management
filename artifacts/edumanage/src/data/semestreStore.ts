import { SEMESTRES } from "./mockData";

export interface SemestreRecord {
  id: string;
  nom: string;
  alias: string;
  niveau: string;
  niveauId: string;
  filiere: string;
  periode: string;
  statut: "actif" | "futur" | "clos";
}

const STORAGE_KEY = "edumanage-semestre-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** SEMESTRES (data/mockData.ts) est importé et lu directement par une vingtaine d'autres fichiers
 * (notes, absences, relevés, bulletins...). Ce store mute donc ce même tableau en place, comme
 * filiereStore.ts et niveauStore.ts. Seul getSemestres() (usage réactif) renvoie un instantané. */
const semestres = SEMESTRES as unknown as SemestreRecord[];

function loadPersisted() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as SemestreRecord[];
    semestres.splice(0, semestres.length, ...saved);
  } catch {
    /* conserve le seed en cas d'erreur de lecture */
  }
}

let snapshot: SemestreRecord[] = [];

function refreshSnapshot() {
  snapshot = [...semestres];
}

loadPersisted();
refreshSnapshot();

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(semestres));
  }
  refreshSnapshot();
  notify();
}

export function subscribeSemestres(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSemestres(): SemestreRecord[] {
  return snapshot;
}

export function getSemestreById(id: string): SemestreRecord | undefined {
  return semestres.find((s) => s.id === id);
}

export type SemestreInput = Omit<SemestreRecord, "id">;

export function addSemestre(payload: SemestreInput): SemestreRecord {
  const record: SemestreRecord = { id: `s-${Date.now()}`, ...payload };
  semestres.push(record);
  persist();
  return record;
}

export function updateSemestre(id: string, patch: Partial<SemestreInput>) {
  const s = semestres.find((x) => x.id === id);
  if (!s) return;
  Object.assign(s, patch);
  persist();
}

export function deleteSemestre(id: string) {
  const idx = semestres.findIndex((s) => s.id === id);
  if (idx >= 0) semestres.splice(idx, 1);
  persist();
}
