import { getDeliberationForClasseSemestre, type DecisionJury } from "./deliberationStore";

const STORAGE_KEY = "edumanage-attestation-store-v1";

export type AttestationType = "scolarite" | "inscription" | "reussite";

export const TYPE_LABELS: Record<AttestationType, string> = {
  scolarite: "Certificat de scolarité",
  inscription: "Attestation d'inscription",
  reussite: "Attestation de réussite",
};

const DECISION_LABELS: Record<DecisionJury, string> = {
  admis: "Admis",
  ajourne: "Ajourné",
  rattrapage: "Rattrapage",
  exclu: "Exclu",
  a_declasser: "À déclasser",
};

export interface AttestationRecord {
  id: string;
  numero: string;
  etudiantId: string;
  etudiant: string;
  matricule: string;
  classeId: string;
  classe: string;
  filiereId: string;
  filiere: string;
  annee: string;
  type: AttestationType;
  typeLabel: string;
  /** Uniquement pour "reussite" : le semestre réellement vérifié en délibération. */
  semestreId?: string;
  semestreLabel?: string;
  /** Uniquement pour "reussite" : moyenne et décision réellement lues en délibération au moment
   * de la génération (traçabilité — jamais recalculées après coup). */
  moyenneConstatee?: number;
  decisionConstatee?: DecisionJury;
  /** Solde dû constaté au moment de la génération (traçabilité) — n'a jamais bloqué la génération. */
  soldeDuConstate: number;
  statut: "genere" | "envoyee";
  dateGeneration: string;
  effectuePar: string;
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): AttestationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AttestationRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let store: AttestationRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeAttestations(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAttestations(): AttestationRecord[] {
  return store;
}

function prochainNumero(): string {
  const annee = new Date().getFullYear();
  const compteAnnee = store.filter((a) => a.numero.startsWith(`ATT-${annee}-`)).length;
  return `ATT-${annee}-${String(compteAnnee + 1).padStart(3, "0")}`;
}

export interface EligibiliteReussite {
  eligible: boolean;
  motif?: string;
  decision?: DecisionJury;
  moyenne?: number;
}

/** Vérifie l'éligibilité réelle à une attestation de réussite pour un semestre donné : lit la
 * délibération réellement tenue pour cette classe/semestre (deliberationStore) et exige une
 * décision finale "admis" pour cet étudiant précis — jamais une attestation de complaisance qui
 * ignorerait le jury. */
export function verifierEligibiliteReussite(etudiantId: string, classeId: string, semestreId: string): EligibiliteReussite {
  const deliberation = getDeliberationForClasseSemestre(classeId, semestreId);
  if (!deliberation) {
    return { eligible: false, motif: "Aucune délibération n'a encore eu lieu pour ce semestre — impossible de certifier une réussite." };
  }
  const ligne = deliberation.lignes.find((l) => l.etudiantId === etudiantId);
  if (!ligne) {
    return { eligible: false, motif: "Cet étudiant n'apparaît pas dans la délibération de ce semestre." };
  }
  if (ligne.decisionFinale !== "admis") {
    return {
      eligible: false,
      motif: `Décision du jury pour ce semestre : ${DECISION_LABELS[ligne.decisionFinale]} — l'étudiant n'est pas admis, aucune attestation de réussite ne peut être délivrée.`,
      decision: ligne.decisionFinale,
      moyenne: ligne.moyenne,
    };
  }
  return { eligible: true, decision: ligne.decisionFinale, moyenne: ligne.moyenne };
}

export interface GenererAttestationInput {
  etudiantId: string;
  etudiant: string;
  matricule: string;
  classeId: string;
  classe: string;
  filiereId: string;
  filiere: string;
  annee: string;
  soldeDu: number;
  type: AttestationType;
  semestreId?: string;
  semestreLabel?: string;
  effectuePar: string;
}

export function genererAttestation(input: GenererAttestationInput): AttestationRecord {
  let moyenneConstatee: number | undefined;
  let decisionConstatee: DecisionJury | undefined;
  if (input.type === "reussite" && input.semestreId) {
    const eligibilite = verifierEligibiliteReussite(input.etudiantId, input.classeId, input.semestreId);
    if (!eligibilite.eligible) {
      throw new Error(eligibilite.motif ?? "Étudiant non éligible à l'attestation de réussite pour ce semestre.");
    }
    moyenneConstatee = eligibilite.moyenne;
    decisionConstatee = eligibilite.decision;
  }
  const record: AttestationRecord = {
    id: `att-${Date.now()}`,
    numero: prochainNumero(),
    etudiantId: input.etudiantId,
    etudiant: input.etudiant,
    matricule: input.matricule,
    classeId: input.classeId,
    classe: input.classe,
    filiereId: input.filiereId,
    filiere: input.filiere,
    annee: input.annee,
    type: input.type,
    typeLabel: TYPE_LABELS[input.type],
    semestreId: input.semestreId,
    semestreLabel: input.semestreLabel,
    moyenneConstatee,
    decisionConstatee,
    soldeDuConstate: input.soldeDu,
    statut: "genere",
    dateGeneration: new Date().toISOString().split("T")[0],
    effectuePar: input.effectuePar,
  };
  store.unshift(record);
  persist();
  return record;
}

export function marquerEnvoyee(id: string): void {
  const record = store.find((a) => a.id === id);
  if (!record) return;
  record.statut = "envoyee";
  persist();
}
