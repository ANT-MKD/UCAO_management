import { crediterAvoir, debiterAvoir } from "./studentStore";

const STORAGE_KEY = "edumanage-avoir-remboursements-v1";

export interface RemboursementAvoirRecord {
  id: string;
  reference: string;
  date: string;
  etudiantId: string;
  payeur: string;
  montant: number;
  motif: string;
  moyenRemboursement: string;
  referenceBancaire?: string;
  ajouteePar: string;
  annulee: boolean;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: RemboursementAvoirRecord[];
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
  // et ne re-rend pas si getRemboursementsAvoir() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeRemboursementsAvoir(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRemboursementsAvoir(): RemboursementAvoirRecord[] {
  return store.records;
}

export function getRemboursementAvoirById(id: string): RemboursementAvoirRecord | undefined {
  return store.records.find((r) => r.id === id);
}

export interface RembourserAvoirPayload {
  etudiantId: string;
  payeur: string;
  montant: number;
  motif: string;
  moyenRemboursement: string;
  referenceBancaire?: string;
  date: string;
  ajouteePar: string;
}

/** Rembourse en argent réel une partie ou la totalité du solde d'avoir d'un étudiant. Refuse si le montant dépasse le solde disponible. */
export function rembourserAvoir(payload: RembourserAvoirPayload): { ok: true; record: RemboursementAvoirRecord } | { ok: false; reason: string } {
  const debited = debiterAvoir(payload.etudiantId, payload.montant);
  if (!debited) {
    return { ok: false, reason: "Solde avoir insuffisant pour ce montant." };
  }

  store.counter = (store.counter ?? 0) + 1;
  const year = new Date(payload.date).getFullYear() || new Date().getFullYear();
  const reference = `REMB-${year}-${String(store.counter).padStart(3, "0")}`;

  const record: RemboursementAvoirRecord = {
    id: `remb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    date: payload.date,
    etudiantId: payload.etudiantId,
    payeur: payload.payeur,
    montant: payload.montant,
    motif: payload.motif,
    moyenRemboursement: payload.moyenRemboursement,
    referenceBancaire: payload.referenceBancaire,
    ajouteePar: payload.ajouteePar,
    annulee: false,
  };

  store.records = [record, ...store.records];
  persist();
  return { ok: true, record };
}

/** Annule un remboursement : recrédite le solde d'avoir de l'étudiant. Toujours possible (recréditer ne peut jamais mettre un solde en négatif). */
export function annulerRemboursementAvoir(id: string): void {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.annulee) return;
  crediterAvoir(record.etudiantId, record.montant);
  store.records = store.records.map((r) => (r.id === id ? { ...r, annulee: true } : r));
  persist();
}
