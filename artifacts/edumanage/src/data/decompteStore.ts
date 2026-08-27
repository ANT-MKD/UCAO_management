const STORAGE_KEY = "edumanage-decomptes-v1";

export type TypeDecompte = "taux_horaire" | "forfait" | "a_terme";

export interface DecompteLigne {
  pointageId: string;
  ecId: string;
  classeId: string;
  coursLabel: string;
  duree: number;
  date: string;
  niveauLabel: string;
  classeLabel: string;
  anneeLabel: string;
  semestreLabel: string;
  montantBrut: number;
  abattementPct: number;
  abattementMontant: number;
  montantNet: number;
}

export interface DecompteRecord {
  id: string;
  reference: string;
  date: string;
  teacherId: string;
  professeur: string;
  type: TypeDecompte;
  annee: string;
  montantDecompte: number;
  netAPayer: number;
  montantPaye: number;
  statut: "emis" | "annule";
  ajouteePar: string;
  lignes: DecompteLigne[];
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: DecompteRecord[];
  counter: number;
}

function load(): Persisted {
  if (typeof window === "undefined") return { records: [], counter: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [], counter: 0 };
    return JSON.parse(raw) as Persisted;
  } catch {
    return { records: [], counter: 0 };
  }
}

let store: Persisted = load();

function persist() {
  // Nouvelle référence de tableau : useSyncExternalStore compare par Object.is
  // et ne re-rend pas si getDecomptes() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeDecomptes(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDecomptes(): DecompteRecord[] {
  return store.records;
}

export function getDecompteById(id: string): DecompteRecord | undefined {
  return store.records.find((r) => r.id === id);
}

/** Identifiants de pointage déjà inclus dans un décompte non annulé — à exclure des prochaines générations. */
export function getPointageIdsDejaDecomptes(): Set<string> {
  const ids = new Set<string>();
  for (const r of store.records) {
    if (r.statut === "annule") continue;
    for (const l of r.lignes) ids.add(l.pointageId);
  }
  return ids;
}

export interface GenererDecomptePayload {
  teacherId: string;
  professeur: string;
  type: TypeDecompte;
  annee: string;
  date: string;
  ajouteePar: string;
  lignes: DecompteLigne[];
}

/** Génère un décompte à partir de lignes déjà calculées (une ligne par pointage validé retenu). */
export function genererDecompte(payload: GenererDecomptePayload): DecompteRecord {
  store.counter = (store.counter ?? 0) + 1;
  const year = new Date(payload.date).getFullYear() || new Date().getFullYear();
  const reference = `DC-${year}-${String(store.counter).padStart(3, "0")}`;

  const montantDecompte = payload.lignes.reduce((s, l) => s + l.montantBrut, 0);
  const netAPayer = payload.lignes.reduce((s, l) => s + l.montantNet, 0);

  const record: DecompteRecord = {
    id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    date: payload.date,
    teacherId: payload.teacherId,
    professeur: payload.professeur,
    type: payload.type,
    annee: payload.annee,
    montantDecompte,
    netAPayer,
    montantPaye: 0,
    statut: "emis",
    ajouteePar: payload.ajouteePar,
    lignes: payload.lignes,
  };

  store.records = [record, ...store.records];
  persist();
  return record;
}

/** Annule un décompte émis (les pointages qu'il contenait redeviennent éligibles pour un futur décompte). */
export function annulerDecompte(id: string): void {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.statut === "annule") return;
  store.records = store.records.map((r) => (r.id === id ? { ...r, statut: "annule" as const } : r));
  persist();
}
