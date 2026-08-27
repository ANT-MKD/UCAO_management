import { addPriseEnCharge, cancelPriseEnCharge, type TypePEC, type PriseEnChargeLigne } from "./priseEnChargeStore";

const STORAGE_KEY = "edumanage-pec-masse-v1";

export interface PECMasseRecord {
  id: string;
  reference: string;
  organismeId: string;
  organisme: string;
  type: TypePEC;
  montant?: number;
  pourcentage?: number;
  filiereId: string;
  filiere: string;
  annee: string;
  niveauId: string;
  niveau: string;
  classeId: string;
  classe: string;
  debut: string;
  fin: string;
  dateLimite: string;
  filtreFrais?: string;
  emisLe: string;
  ajouteePar: string;
  priseEnChargeIds: string[];
  annulee: boolean;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: PECMasseRecord[];
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
  // et ne re-rend pas si getPECsMasse() renvoie la même référence.
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribePECsMasse(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPECsMasse(): PECMasseRecord[] {
  return store.records;
}

export function getPECMasseById(id: string): PECMasseRecord | undefined {
  return store.records.find((r) => r.id === id);
}

/** PEC en masse active (non annulée) déjà enregistrée pour cette classe/année/organisme — avertissement anti-doublon (non bloquant). */
export function findActivePECMasseForClasse(classeId: string, annee: string, organismeId: string): PECMasseRecord | undefined {
  return store.records.find((r) => r.classeId === classeId && r.annee === annee && r.organismeId === organismeId && !r.annulee);
}

export interface PECMasseEtudiantPayload {
  etudiantId: string;
  etudiant: string;
  lignes: PriseEnChargeLigne[];
}

export interface AddPECMassePayload {
  organismeId: string;
  organisme: string;
  type: TypePEC;
  montant?: number;
  pourcentage?: number;
  filiereId: string;
  filiere: string;
  annee: string;
  niveauId: string;
  niveau: string;
  classeId: string;
  classe: string;
  debut: string;
  fin: string;
  dateLimite: string;
  filtreFrais?: string;
  ajouteePar: string;
  etudiants: PECMasseEtudiantPayload[];
}

/**
 * Génère une prise en charge par étudiant retenu de la classe (mêmes conditions : organisme, type,
 * montant/pourcentage, période) — chaque PEC créée reste individuellement consultable/régularisable
 * dans Les prises en charge, comme une quittance issue d'une émission en masse.
 */
export function addPECMasse(payload: AddPECMassePayload): PECMasseRecord {
  store.counter = (store.counter ?? 0) + 1;
  const reference = `PECM-${payload.annee.slice(0, 4)}-${String(store.counter).padStart(3, "0")}`;
  const emisLe = new Date().toISOString().slice(0, 10);

  const priseEnChargeIds = payload.etudiants
    .filter((e) => e.lignes.length > 0)
    .map(
      (e) =>
        addPriseEnCharge({
          type: payload.type,
          dateSaisie: emisLe,
          organismeId: payload.organismeId,
          organisme: payload.organisme,
          etudiantId: e.etudiantId,
          etudiant: e.etudiant,
          filiere: payload.filiere,
          annee: payload.annee,
          debut: payload.debut,
          fin: payload.fin,
          dateLimite: payload.dateLimite,
          montant: payload.type === "montant" ? payload.montant : undefined,
          pourcentage: payload.type === "pourcentage" ? payload.pourcentage : undefined,
          referenceExterne: `Lot ${reference}`,
          ajouteePar: payload.ajouteePar,
          lignes: e.lignes,
        }).id,
    );

  const record: PECMasseRecord = {
    id: `pecm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reference,
    organismeId: payload.organismeId,
    organisme: payload.organisme,
    type: payload.type,
    montant: payload.montant,
    pourcentage: payload.pourcentage,
    filiereId: payload.filiereId,
    filiere: payload.filiere,
    annee: payload.annee,
    niveauId: payload.niveauId,
    niveau: payload.niveau,
    classeId: payload.classeId,
    classe: payload.classe,
    debut: payload.debut,
    fin: payload.fin,
    dateLimite: payload.dateLimite,
    filtreFrais: payload.filtreFrais,
    emisLe,
    ajouteePar: payload.ajouteePar,
    priseEnChargeIds,
    annulee: false,
  };

  store.records = [record, ...store.records];
  persist();
  return record;
}

/** Annule toute la génération : annule chaque prise en charge créée par ce lot. */
export function cancelPECMasse(id: string): void {
  const record = store.records.find((r) => r.id === id);
  if (!record || record.annulee) return;
  record.priseEnChargeIds.forEach((pecId) => cancelPriseEnCharge(pecId));
  store.records = store.records.map((r) => (r.id === id ? { ...r, annulee: true } : r));
  persist();
}
