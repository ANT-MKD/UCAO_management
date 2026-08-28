const STORAGE_KEY = "edumanage-frais-config-v1";

export interface FraisConfigRecord {
  id: string;
  filiere: string;
  filiereId: string;
  niveau: string;
  annee: string;
  inscription: number;
  scolariteAnnuelle: number;
  fraisDivers: number;
}

function seed(): FraisConfigRecord[] {
  return [
    { id: "fr1", filiere: "LPIG", filiereId: "f1", niveau: "L1", annee: "2025-2026", inscription: 150000, scolariteAnnuelle: 700000, fraisDivers: 25000 },
    { id: "fr2", filiere: "LPIG", filiereId: "f1", niveau: "L2", annee: "2025-2026", inscription: 150000, scolariteAnnuelle: 750000, fraisDivers: 25000 },
    { id: "fr3", filiere: "GESTION", filiereId: "f3", niveau: "L1", annee: "2025-2026", inscription: 120000, scolariteAnnuelle: 600000, fraisDivers: 20000 },
    { id: "fr4", filiere: "DROIT", filiereId: "f2", niveau: "L1", annee: "2025-2026", inscription: 130000, scolariteAnnuelle: 640000, fraisDivers: 20000 },
    { id: "fr5", filiere: "COMPTA", filiereId: "f4", niveau: "BTS1", annee: "2025-2026", inscription: 100000, scolariteAnnuelle: 560000, fraisDivers: 15000 },
  ];
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): FraisConfigRecord[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    return JSON.parse(raw) as FraisConfigRecord[];
  } catch {
    return seed();
  }
}

let store: FraisConfigRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeFraisConfigs(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getFraisConfigs(): FraisConfigRecord[] {
  return store;
}

export function getFraisConfig(id: string): FraisConfigRecord | undefined {
  return store.find((f) => f.id === id);
}

export interface UpsertFraisConfigPayload {
  id?: string;
  filiere: string;
  filiereId: string;
  niveau: string;
  annee: string;
  inscription: number;
  scolariteAnnuelle: number;
  fraisDivers: number;
}

/** Crée une nouvelle grille (id absent) ou remplace une grille existante (id fourni). */
export function upsertFraisConfig(payload: UpsertFraisConfigPayload): FraisConfigRecord {
  const id = payload.id ?? `fr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record: FraisConfigRecord = {
    id,
    filiere: payload.filiere,
    filiereId: payload.filiereId,
    niveau: payload.niveau,
    annee: payload.annee,
    inscription: payload.inscription,
    scolariteAnnuelle: payload.scolariteAnnuelle,
    fraisDivers: payload.fraisDivers,
  };
  const idx = store.findIndex((f) => f.id === id);
  if (idx >= 0) store[idx] = record;
  else store.push(record);
  persist();
  return record;
}

export function supprimerFraisConfig(id: string): void {
  store = store.filter((f) => f.id !== id);
  persist();
}
