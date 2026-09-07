import { getGrilleFrais, calculerEcheances, nbEcheancesEffectif } from "./grilleFraisStore";
import { getEtudiants, emettreQuittanceBrute, cancelQuittanceEmise } from "./studentStore";

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
  modeleFraisId: string;
  /** Libellés des lignes de la grille tarifaire facturées par cette émission (dénormalisés pour l'affichage). */
  ligneIntitules: string[];
  /** Date de facturation des lignes "avant inscription" — les lignes "échéances" utilisent leurs propres dates issues de la grille. */
  dateFacturation: string;
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

export function getEmissionMasseByQuittanceId(quittanceId: string): EmissionMasseRecord | undefined {
  return store.records.find((r) => r.quittanceIds.includes(quittanceId));
}

/** Émission active (non annulée) déjà enregistrée pour cette classe/année — sert d'avertissement anti-doublon (non bloquant). */
export function findActiveEmissionForClasse(classeId: string, annee: string): EmissionMasseRecord | undefined {
  return store.records.find((r) => r.classeId === classeId && r.annee === annee && !r.annulee);
}

/** Total (par étudiant) des lignes sélectionnées de la grille tarifaire — utilisé pour l'aperçu du montant avant émission. */
export function montantGrilleLignes(filiereId: string, niveau: string, annee: string, modeleFraisId: string, ligneIds: string[]): number {
  const grille = getGrilleFrais(filiereId, niveau, annee, modeleFraisId);
  if (!grille) return 0;
  return grille.lignes.filter((l) => ligneIds.includes(l.id)).reduce((s, l) => s + l.montant, 0);
}

export interface AddEmissionMassePayload {
  filiereId: string;
  filiere: string;
  annee: string;
  niveauId: string;
  niveau: string;
  classeId: string;
  classe: string;
  modeleFraisId: string;
  /** Lignes de la grille tarifaire (filiere/niveau/annee/modele) à facturer. */
  ligneIds: string[];
  dateFacturation: string;
  commentaire: string;
  emisPar: string;
  /** Étudiants effectivement facturés (après exclusions) */
  etudiantIds: string[];
}

/**
 * Génère une quittance (facturée, non encaissée) pour chaque étudiant retenu, à partir des
 * lignes choisies dans la grille tarifaire (Configuration des frais). Les lignes "avant
 * inscription" sont regroupées en une quittance datée de `dateFacturation` ; chaque ligne
 * "échéances" génère une quittance par échéance, aux dates calculées par la grille tarifaire.
 */
export function addEmissionMasse(payload: AddEmissionMassePayload): EmissionMasseRecord {
  const grille = getGrilleFrais(payload.filiereId, payload.niveau, payload.annee, payload.modeleFraisId);
  const lignes = (grille?.lignes ?? []).filter((l) => payload.ligneIds.includes(l.id));
  const lignesObligatoires = lignes.filter((l) => l.modalite === "avant_inscription");
  const lignesEcheancier = lignes.filter((l) => l.modalite === "echeances");

  const etudiants = getEtudiants().filter((e) => payload.etudiantIds.includes(e.id));
  const emisLe = new Date().toISOString().slice(0, 10);

  store.counter = (store.counter ?? 0) + 1;
  const reference = `EM-${payload.annee.slice(0, 4)}-${String(store.counter).padStart(3, "0")}`;

  const quittanceIds: string[] = [];
  for (const etu of etudiants) {
    if (lignesObligatoires.length > 0) {
      quittanceIds.push(
        emettreQuittanceBrute({
          etudiantId: etu.id,
          date: payload.dateFacturation,
          dateLimite: payload.dateFacturation,
          lignes: lignesObligatoires.map((l) => ({ label: l.intitule, montant: l.montant })),
          reference,
        }).id,
      );
    }
    for (const ligne of lignesEcheancier) {
      for (const ech of calculerEcheances(ligne, payload.annee)) {
        quittanceIds.push(
          emettreQuittanceBrute({
            etudiantId: etu.id,
            date: ech.date,
            dateLimite: ech.date,
            lignes: [{ label: `${ligne.intitule} — Échéance ${ech.index}/${nbEcheancesEffectif(ligne)}`, montant: ech.montant }],
            reference: `${reference}-${ligne.id}-${ech.index}`,
          }).id,
        );
      }
    }
  }

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
    modeleFraisId: payload.modeleFraisId,
    ligneIntitules: lignes.map((l) => l.intitule),
    dateFacturation: payload.dateFacturation,
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
