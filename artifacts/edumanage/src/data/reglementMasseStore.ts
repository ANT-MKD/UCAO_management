import { enregistrerEncaissementSurPEC, retirerEncaissementSurPEC } from "./priseEnChargeStore";

const STORAGE_KEY = "edumanage-reglements-masse-v1";

export interface ReglementMasseLigne {
  priseEnChargeId: string;
  reference: string;
  etudiant: string;
  montant: number;
}

export interface ReglementMasseRecord {
  id: string;
  reference: string;
  organismeId: string;
  organisme: string;
  annee: string;
  date: string;
  modePaiement: string;
  referenceBancaire?: string;
  montantGlobal: number;
  ajouteePar: string;
  lignes: ReglementMasseLigne[];
  annulee: boolean;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: ReglementMasseRecord[];
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
  // et ne re-rend pas si getReglementsMasse() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeReglementsMasse(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getReglementsMasse(): ReglementMasseRecord[] {
  return store.records;
}

export function getReglementMasseById(id: string): ReglementMasseRecord | undefined {
  return store.records.find((r) => r.id === id);
}

export interface AddReglementMassePayload {
  organismeId: string;
  organisme: string;
  annee: string;
  date: string;
  modePaiement: string;
  referenceBancaire?: string;
  montantGlobal: number;
  ajouteePar: string;
  lignes: ReglementMasseLigne[];
}

/** Enregistre un règlement en masse : répartit un montant global reçu d'un organisme sur plusieurs PEC (payerQuittance déjà appliqué en amont via enregistrerEncaissementSurPEC). */
export function addReglementMasse(payload: AddReglementMassePayload): ReglementMasseRecord {
  store.counter = (store.counter ?? 0) + 1;
  const reference = `REGM-${payload.annee.slice(0, 4)}-${String(store.counter).padStart(3, "0")}`;

  const lignesAppliquees = payload.lignes.filter((l) => l.montant > 0);
  lignesAppliquees.forEach((l) => {
    enregistrerEncaissementSurPEC(l.priseEnChargeId, l.montant);
  });

  const record: ReglementMasseRecord = {
    id: `regm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    organismeId: payload.organismeId,
    organisme: payload.organisme,
    annee: payload.annee,
    date: payload.date,
    modePaiement: payload.modePaiement,
    referenceBancaire: payload.referenceBancaire,
    montantGlobal: payload.montantGlobal,
    ajouteePar: payload.ajouteePar,
    lignes: lignesAppliquees,
    annulee: false,
  };

  store.records = [record, ...store.records];
  persist();
  return record;
}

/** Annule le règlement en masse : retire l'encaissement reconnu sur chaque PEC concernée. */
export function cancelReglementMasse(id: string): void {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.annulee) return;
  record.lignes.forEach((l) => retirerEncaissementSurPEC(l.priseEnChargeId, l.montant));
  store.records = store.records.map((r) => (r.id === id ? { ...r, annulee: true } : r));
  persist();
}
