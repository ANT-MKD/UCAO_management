import { enregistrerEncaissementSurPEC } from "./priseEnChargeStore";

const STORAGE_KEY = "edumanage-encaissements-pec-v1";

export interface EncaissementPECLigne {
  priseEnChargeId: string;
  reference: string;
  montant: number;
}

export interface EncaissementPECRecord {
  id: string;
  reference: string;
  organismeId: string;
  organisme: string;
  date: string;
  modePaiement: string;
  referenceBancaire?: string;
  ajouteePar: string;
  lignes: EncaissementPECLigne[];
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: EncaissementPECRecord[];
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
  // et ne re-rend pas si getEncaissementsPEC() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeEncaissementsPEC(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getEncaissementsPEC(): EncaissementPECRecord[] {
  return store.records;
}

export function getEncaissementPECById(id: string): EncaissementPECRecord | undefined {
  return store.records.find((r) => r.id === id);
}

export interface AddEncaissementPECPayload {
  organismeId: string;
  organisme: string;
  date: string;
  modePaiement: string;
  referenceBancaire?: string;
  ajouteePar: string;
  lignes: EncaissementPECLigne[];
}

/** Enregistre l'encaissement réel d'un ou plusieurs montants engagés via des PEC, pour le même organisme. */
export function addEncaissementPEC(payload: AddEncaissementPECPayload): EncaissementPECRecord {
  store.counter = (store.counter ?? 0) + 1;
  const reference = `ENC-PEC-${payload.date.slice(0, 4)}-${String(store.counter).padStart(3, "0")}`;

  const lignesAppliquees = payload.lignes.filter((l) => l.montant > 0);
  lignesAppliquees.forEach((l) => {
    enregistrerEncaissementSurPEC(l.priseEnChargeId, l.montant);
  });

  const record: EncaissementPECRecord = {
    id: `enc-pec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    organismeId: payload.organismeId,
    organisme: payload.organisme,
    date: payload.date,
    modePaiement: payload.modePaiement,
    referenceBancaire: payload.referenceBancaire,
    ajouteePar: payload.ajouteePar,
    lignes: lignesAppliquees,
  };

  store.records = [record, ...store.records];
  persist();
  return record;
}
