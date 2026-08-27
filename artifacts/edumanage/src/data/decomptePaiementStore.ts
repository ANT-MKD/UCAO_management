import { getDecompteById, payerDecompte, reverserPaiementDecompte } from "./decompteStore";

const STORAGE_KEY = "edumanage-decompte-paiements-v1";

export interface DecomptePaiementRecord {
  id: string;
  reference: string;
  date: string;
  decompteId: string;
  decompteReference: string;
  teacherId: string;
  professeur: string;
  montant: number;
  moyen: string;
  referenceBancaire?: string;
  payePar: string;
  annulee: boolean;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: DecomptePaiementRecord[];
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
  // et ne re-rend pas si getDecomptePaiements() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeDecomptePaiements(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDecomptePaiements(): DecomptePaiementRecord[] {
  return store.records;
}

export function getDecomptePaiementById(id: string): DecomptePaiementRecord | undefined {
  return store.records.find((r) => r.id === id);
}

export interface EnregistrerPaiementDecomptePayload {
  decompteId: string;
  montant: number;
  moyen: string;
  referenceBancaire?: string;
  date: string;
  payePar: string;
}

/** Enregistre un paiement (total ou partiel) sur un décompte émis : crée le paiement et augmente le montant payé du décompte. */
export function enregistrerPaiementDecompte(
  payload: EnregistrerPaiementDecomptePayload,
): { ok: boolean; reason?: string; record?: DecomptePaiementRecord } {
  const decompte = getDecompteById(payload.decompteId);
  if (!decompte || decompte.statut === "annule") {
    return { ok: false, reason: "Décompte introuvable ou annulé." };
  }
  const resteAPayer = decompte.netAPayer - decompte.montantPaye;
  if (payload.montant <= 0 || payload.montant > resteAPayer) {
    return { ok: false, reason: "Montant invalide — il dépasse le reste à payer sur ce décompte." };
  }

  payerDecompte(payload.decompteId, payload.montant);

  store.counter = (store.counter ?? 0) + 1;
  const year = new Date(payload.date).getFullYear() || new Date().getFullYear();
  const reference = `PP-${year}-${String(store.counter).padStart(3, "0")}`;

  const record: DecomptePaiementRecord = {
    id: `payprof-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    date: payload.date,
    decompteId: payload.decompteId,
    decompteReference: decompte.reference,
    teacherId: decompte.teacherId,
    professeur: decompte.professeur,
    montant: payload.montant,
    moyen: payload.moyen,
    referenceBancaire: payload.referenceBancaire,
    payePar: payload.payePar,
    annulee: false,
  };

  store.records = [record, ...store.records];
  persist();
  return { ok: true, record };
}

/** Annule ce paiement précis : retire le montant du décompte concerné. */
export function annulerPaiementDecompte(id: string): DecomptePaiementRecord | undefined {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.annulee) return undefined;
  reverserPaiementDecompte(record.decompteId, record.montant);
  store.records = store.records.map((r) => (r.id === id ? { ...r, annulee: true } : r));
  persist();
  return record;
}
