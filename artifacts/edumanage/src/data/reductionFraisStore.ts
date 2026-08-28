import { appliquerReductionSolde, annulerReductionSolde } from "./studentStore";

const STORAGE_KEY = "edumanage-reduction-frais-v1";

export interface ReductionFraisRecord {
  id: string;
  reference: string;
  date: string;
  etudiantId: string;
  personnelId: string;
  tauxApplique: number;
  totalReduit: number;
  annulee: boolean;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: ReductionFraisRecord[];
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
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeReductionsFrais(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getReductionsFrais(): ReductionFraisRecord[] {
  return store.records;
}

export function getReductionFraisById(id: string): ReductionFraisRecord | undefined {
  return store.records.find((r) => r.id === id);
}

/** Somme des réductions déjà validées, accordées par cette personne, sur une période donnée (pour calculer le plafond restant). */
export function totalReduitParPersonnelSurPeriode(personnelId: string, dateDebut: string, dateFin: string): number {
  return store.records
    .filter((r) => !r.annulee && r.personnelId === personnelId && r.date >= dateDebut && r.date <= dateFin)
    .reduce((s, r) => s + r.totalReduit, 0);
}

export interface GenererReductionFraisPayload {
  date: string;
  etudiantId: string;
  personnelId: string;
  tauxApplique: number;
  totalReduit: number;
}

/** Enregistre une réduction et l'applique immédiatement (de façon définitive) sur le solde dû de l'étudiant. */
export function genererReductionFrais(payload: GenererReductionFraisPayload): ReductionFraisRecord {
  store.counter = (store.counter ?? 0) + 1;
  const year = new Date(payload.date).getFullYear() || new Date().getFullYear();
  const reference = `RED-${year}-${String(store.counter).padStart(3, "0")}`;

  const record: ReductionFraisRecord = {
    id: `reduc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    date: payload.date,
    etudiantId: payload.etudiantId,
    personnelId: payload.personnelId,
    tauxApplique: payload.tauxApplique,
    totalReduit: payload.totalReduit,
    annulee: false,
  };

  store.records = [record, ...store.records];
  persist();
  appliquerReductionSolde(payload.etudiantId, payload.totalReduit);
  return record;
}

/** Annule une réduction : restaure le montant sur le solde dû de l'étudiant et libère le plafond de son émetteur. */
export function annulerReductionFrais(id: string): { ok: boolean; reason?: string } {
  const record = store.records.find((r) => r.id === id);
  if (!record) return { ok: false, reason: "Réduction introuvable." };
  if (record.annulee) return { ok: false, reason: "Cette réduction est déjà annulée." };
  store.records = store.records.map((r) => (r.id === id ? { ...r, annulee: true } : r));
  persist();
  annulerReductionSolde(record.etudiantId, record.totalReduit);
  return { ok: true };
}
