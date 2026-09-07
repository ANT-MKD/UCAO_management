import { crediterAvoir, debiterAvoir } from "./studentStore";

const STORAGE_KEY = "edumanage-avoir-depots-v1";

export interface AvoirDepotRecord {
  id: string;
  reference: string;
  date: string;
  etudiantId: string;
  payeur: string;
  montant: number;
  motif: string;
  moyenOrigine: string;
  referenceBancaire?: string;
  ajouteePar: string;
  annulee: boolean;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: AvoirDepotRecord[];
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
  // et ne re-rend pas si getAvoirDepots() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeAvoirDepots(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAvoirDepots(): AvoirDepotRecord[] {
  return store.records;
}

export function getAvoirDepotById(id: string): AvoirDepotRecord | undefined {
  return store.records.find((r) => r.id === id);
}

export interface DeposerAvoirPayload {
  etudiantId: string;
  payeur: string;
  montant: number;
  motif: string;
  moyenOrigine: string;
  referenceBancaire?: string;
  date: string;
  ajouteePar: string;
}

/** Crédite le compte d'un étudiant : crée le dépôt et augmente son solde d'avoir. */
export function deposerAvoir(payload: DeposerAvoirPayload): AvoirDepotRecord {
  store.counter = (store.counter ?? 0) + 1;
  const year = new Date(payload.date).getFullYear() || new Date().getFullYear();
  const reference = `DPT-${year}-${String(store.counter).padStart(3, "0")}`;

  crediterAvoir(payload.etudiantId, payload.montant);

  const record: AvoirDepotRecord = {
    id: `dpt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    date: payload.date,
    etudiantId: payload.etudiantId,
    payeur: payload.payeur,
    montant: payload.montant,
    motif: payload.motif,
    moyenOrigine: payload.moyenOrigine,
    referenceBancaire: payload.referenceBancaire,
    ajouteePar: payload.ajouteePar,
    annulee: false,
  };

  store.records = [record, ...store.records];
  persist();
  return record;
}

/** Annule un dépôt d'avoir. Refuse si le crédit a déjà été partiellement ou totalement consommé (solde insuffisant pour le retirer). */
export function annulerDepotAvoir(id: string): { ok: boolean; reason?: string } {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.annulee) return { ok: false, reason: "Dépôt introuvable ou déjà annulé." };
  const debited = debiterAvoir(record.etudiantId, record.montant);
  if (!debited) {
    return { ok: false, reason: "Ce crédit a déjà été partiellement ou totalement utilisé — impossible de l'annuler." };
  }
  store.records = store.records.map((r) => (r.id === id ? { ...r, annulee: true } : r));
  persist();
  return { ok: true };
}
