import { FRAIS_CONFIG } from "./mockData";
import {
  getEtudiants,
  emettreQuittanceBrute,
  cancelQuittanceEmise,
  type PaiementLigne,
} from "./studentStore";

const STORAGE_KEY = "edumanage-emissions-masse-v1";

export interface EmissionMasseRecord {
  id: string;
  reference: string;
  filiereId: string;
  filiere: string;
  annee: string;
  niveauId: string;
  niveau: string;
  classeId: string;
  classe: string;
  dateEcheance: string;
  dateLimite: string;
  commentaire: string;
  emisLe: string;
  emisPar: string;
  quittanceIds: string[];
  annulee: boolean;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: EmissionMasseRecord[];
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
  // et ne re-rend pas si getEmissionsMasse() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeEmissionsMasse(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getEmissionsMasse(): EmissionMasseRecord[] {
  return store.records;
}

export function getEmissionMasseById(id: string): EmissionMasseRecord | undefined {
  return store.records.find((r) => r.id === id);
}

export interface AddEmissionMassePayload {
  filiereId: string;
  filiere: string;
  annee: string;
  niveauId: string;
  niveau: string;
  classeId: string;
  classe: string;
  dateEcheance: string;
  dateLimite: string;
  commentaire: string;
  emisPar: string;
}

/**
 * Génère une quittance (facturée, non encaissée) pour chaque étudiant de la classe visée,
 * à partir de la grille tarifaire (scolarité annuelle) configurée pour filière/niveau/année.
 */
export function addEmissionMasse(payload: AddEmissionMassePayload): EmissionMasseRecord {
  const grille = FRAIS_CONFIG.find(
    (f) => f.filiereId === payload.filiereId && f.niveau === payload.niveau && f.annee === payload.annee,
  );
  const lignes: PaiementLigne[] = grille
    ? [{ label: "Scolarité annuelle", montant: grille.scolariteAnnuelle }]
    : [{ label: "Scolarité annuelle", montant: 0 }];

  const etudiants = getEtudiants().filter((e) => e.classeId === payload.classeId && e.statut !== "suspendu");
  const emisLe = new Date().toISOString().slice(0, 10);

  store.counter = (store.counter ?? 0) + 1;
  const reference = `EM-${payload.annee.slice(0, 4)}-${String(store.counter).padStart(3, "0")}`;

  const quittanceIds = etudiants.map(
    (etu) =>
      emettreQuittanceBrute({
        etudiantId: etu.id,
        date: payload.dateEcheance,
        dateLimite: payload.dateLimite,
        lignes,
        reference,
      }).id,
  );

  const record: EmissionMasseRecord = {
    id: `emm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    filiereId: payload.filiereId,
    filiere: payload.filiere,
    annee: payload.annee,
    niveauId: payload.niveauId,
    niveau: payload.niveau,
    classeId: payload.classeId,
    classe: payload.classe,
    dateEcheance: payload.dateEcheance,
    dateLimite: payload.dateLimite,
    commentaire: payload.commentaire.trim(),
    emisLe,
    emisPar: payload.emisPar,
    quittanceIds,
    annulee: false,
  };

  store.records = [record, ...store.records];
  persist();
  return record;
}

/** Annule la génération : annule chaque quittance non encore payée qu'elle a créée. */
export function cancelEmissionMasse(id: string): void {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.annulee) return;
  record.quittanceIds.forEach((qid) => cancelQuittanceEmise(qid));
  store.records = store.records.map((r) => (r.id === id ? { ...r, annulee: true } : r));
  persist();
}

