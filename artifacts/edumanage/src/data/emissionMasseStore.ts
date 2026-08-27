import { FRAIS_CONFIG } from "./mockData";
import { getEtudiants, emettreQuittanceBrute, cancelQuittanceEmise } from "./studentStore";

const STORAGE_KEY = "edumanage-emissions-masse-v1";

export type RubriqueEmission = "inscription" | "scolarite" | "fraisDivers";

export const RUBRIQUE_EMISSION_LABELS: Record<RubriqueEmission, string> = {
  inscription: "Frais d'inscription",
  scolarite: "Scolarité annuelle",
  fraisDivers: "Frais divers",
};

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
  rubriques: RubriqueEmission[];
  nbMensualites: number;
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

export function montantGrilleParRubrique(
  filiereId: string,
  niveau: string,
  annee: string,
  rubriques: RubriqueEmission[],
): number {
  const grille = FRAIS_CONFIG.find((f) => f.filiereId === filiereId && f.niveau === niveau && f.annee === annee);
  if (!grille) return 0;
  return rubriques.reduce((sum, r) => {
    if (r === "inscription") return sum + grille.inscription;
    if (r === "scolarite") return sum + grille.scolariteAnnuelle;
    return sum + grille.fraisDivers;
  }, 0);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Répartit `total` en `n` parts entières, en ajoutant le reliquat d'arrondi aux premières parts. */
function splitMontant(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => (i < remainder ? base + 1 : base));
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
  rubriques: RubriqueEmission[];
  /** 1 = paiement unique, >1 = étalé en N mensualités égales */
  nbMensualites: number;
  /** Étudiants effectivement facturés (après exclusions) */
  etudiantIds: string[];
}

/**
 * Génère une quittance (facturée, non encaissée) pour chaque étudiant retenu, à partir des
 * rubriques choisies dans la grille tarifaire (Configuration des frais). Si nbMensualites > 1,
 * le montant est étalé sur autant de quittances par étudiant, une par échéance mensuelle.
 */
export function addEmissionMasse(payload: AddEmissionMassePayload): EmissionMasseRecord {
  const rubriquesLabel = payload.rubriques.map((r) => RUBRIQUE_EMISSION_LABELS[r]).join(" + ") || "Frais";
  const totalMontant = montantGrilleParRubrique(payload.filiereId, payload.niveau, payload.annee, payload.rubriques);
  const nbMensualites = Math.max(1, Math.round(payload.nbMensualites || 1));

  const etudiants = getEtudiants().filter((e) => payload.etudiantIds.includes(e.id));
  const emisLe = new Date().toISOString().slice(0, 10);

  store.counter = (store.counter ?? 0) + 1;
  const reference = `EM-${payload.annee.slice(0, 4)}-${String(store.counter).padStart(3, "0")}`;

  const quittanceIds: string[] = [];
  for (const etu of etudiants) {
    if (nbMensualites <= 1) {
      quittanceIds.push(
        emettreQuittanceBrute({
          etudiantId: etu.id,
          date: payload.dateEcheance,
          dateLimite: payload.dateLimite,
          lignes: [{ label: rubriquesLabel, montant: totalMontant }],
          reference,
        }).id,
      );
      continue;
    }
    const parts = splitMontant(totalMontant, nbMensualites);
    for (let i = 0; i < nbMensualites; i++) {
      quittanceIds.push(
        emettreQuittanceBrute({
          etudiantId: etu.id,
          date: addMonths(payload.dateEcheance, i),
          dateLimite: addMonths(payload.dateLimite, i),
          lignes: [{ label: `${rubriquesLabel} — Échéance ${i + 1}/${nbMensualites}`, montant: parts[i] }],
          reference: `${reference}-${i + 1}`,
        }).id,
      );
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
    dateEcheance: payload.dateEcheance,
    dateLimite: payload.dateLimite,
    commentaire: payload.commentaire.trim(),
    emisLe,
    emisPar: payload.emisPar,
    rubriques: payload.rubriques,
    nbMensualites,
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
