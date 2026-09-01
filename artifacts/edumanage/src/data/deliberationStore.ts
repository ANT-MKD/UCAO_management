import { computeBulletinPourClasse } from "./bulletinEngine";
import { getHeuresAbsenceNonJustifieePourEtudiant } from "./assiduiteEngine";
import { decideValidation, type RegleValidationRecord } from "./reglesValidationStore";
import { detecterDeclassementEtudiant, type RaisonDeclassement } from "./declassementEngine";

const STORAGE_KEY = "edumanage-deliberation-store-v1";

export type DecisionJury = "admis" | "ajourne" | "rattrapage" | "exclu" | "a_declasser";

export interface DeliberationLigne {
  etudiantId: string;
  etudiant: string;
  matricule: string;
  moyenne: number;
  creditsObtenus: number;
  creditsTotal: number;
  absences: number;
  /** Décision réellement issue de la règle de validation configurée (reglesValidationStore), ou
   * "a_declasser" si le déclassement (Paramétrage bulletins) s'applique — jamais modifiée en
   * place, sert de référence pour repérer les décisions corrigées manuellement. */
  decisionAuto: DecisionJury;
  /** Décision retenue — égale à decisionAuto sauf correction manuelle du jury avant clôture. */
  decisionFinale: DecisionJury;
  overrideRaison?: string;
  overrideModifiePar?: string;
  /** Détail des EC/type d'évaluation insuffisamment notés — présent uniquement si decisionAuto
   * vaut "a_declasser". */
  raisonsDeclassement?: RaisonDeclassement[];
}

export interface DeliberationRecord {
  id: string;
  filiereId: string;
  filiere: string;
  annee: string;
  niveau: string;
  niveauLabel: string;
  classeId: string;
  classe: string;
  semestreId: string;
  semestre: string;
  effectuePar: string;
  dateDeliberation: string;
  statut: "en_cours" | "cloturee" | "reouverte";
  lignes: DeliberationLigne[];
}

interface Persisted {
  deliberations: DeliberationRecord[];
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): Persisted {
  if (typeof window === "undefined") return { deliberations: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { deliberations: [] };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return { deliberations: parsed.deliberations ?? [] };
  } catch {
    return { deliberations: [] };
  }
}

let store: Persisted = load();

function persist() {
  store = { deliberations: store.deliberations.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeDeliberations(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDeliberations(): DeliberationRecord[] {
  return store.deliberations;
}

export function getDeliberationById(id: string): DeliberationRecord | undefined {
  return store.deliberations.find((d) => d.id === id);
}

export function getDeliberationForClasseSemestre(classeId: string, semestreId: string): DeliberationRecord | undefined {
  return store.deliberations.find((d) => d.classeId === classeId && d.semestreId === semestreId);
}

export interface EtudiantPourDeliberation {
  id: string;
  prenom: string;
  nom: string;
  matricule: string;
}

export interface ChargerDeliberationInput {
  filiereId: string;
  filiere: string;
  annee: string;
  niveauAlias: string;
  niveauLabel: string;
  classeId: string;
  classe: string;
  semestreId: string;
  semestreAlias: string;
  semestreLabel: string;
  etudiants: EtudiantPourDeliberation[];
  regle: RegleValidationRecord;
  effectuePar: string;
}

function calculerLigne(e: EtudiantPourDeliberation, input: ChargerDeliberationInput): DeliberationLigne {
  const bulletin = computeBulletinPourClasse(e.id, input.classeId, input.semestreAlias);
  const moyenne = bulletin?.moyenneSession ?? 0;
  const absences = getHeuresAbsenceNonJustifieePourEtudiant(e.id, input.classeId, input.semestreAlias);

  const declassement = detecterDeclassementEtudiant(e.id, input.classeId, input.filiereId, input.niveauAlias, input.annee, input.semestreAlias);
  const decisionAuto: DecisionJury = declassement ? "a_declasser" : decideValidation(moyenne, bulletin?.creditsObtenus ?? 0, absences, input.regle);

  return {
    etudiantId: e.id,
    etudiant: `${e.prenom} ${e.nom}`,
    matricule: e.matricule,
    moyenne: parseFloat(moyenne.toFixed(2)),
    creditsObtenus: bulletin?.creditsObtenus ?? 0,
    creditsTotal: bulletin?.creditsTotal ?? 0,
    absences,
    decisionAuto,
    decisionFinale: decisionAuto,
    raisonsDeclassement: declassement?.raisons,
  };
}

/** Crée (ou recharge) la délibération d'une classe/session — jamais deux enregistrements pour la
 * même (classe, semestre) : recharger recalcule les décisions automatiques à partir des vraies
 * notes actuelles, mais préserve les corrections manuelles déjà posées par le jury tant que la
 * délibération n'est pas clôturée. Une délibération clôturée n'est jamais recalculée (lecture
 * seule) — il faut la rouvrir explicitement (reouvrirDeliberation) pour la modifier à nouveau. */
export function chargerDeliberation(input: ChargerDeliberationInput): DeliberationRecord {
  const existing = getDeliberationForClasseSemestre(input.classeId, input.semestreId);
  if (existing && existing.statut === "cloturee") {
    return existing;
  }

  const overridesParEtudiant = new Map(
    (existing?.lignes ?? [])
      .filter((l) => l.decisionFinale !== l.decisionAuto)
      .map((l) => [l.etudiantId, l]),
  );

  const lignes = input.etudiants.map((e) => {
    const ligne = calculerLigne(e, input);
    const override = overridesParEtudiant.get(e.id);
    if (override) {
      return { ...ligne, decisionFinale: override.decisionFinale, overrideRaison: override.overrideRaison, overrideModifiePar: override.overrideModifiePar };
    }
    return ligne;
  });

  if (existing) {
    existing.lignes = lignes;
    existing.statut = existing.statut === "reouverte" ? "reouverte" : "en_cours";
    existing.dateDeliberation = new Date().toISOString();
    existing.effectuePar = input.effectuePar;
    persist();
    return existing;
  }

  const record: DeliberationRecord = {
    id: `delib-${Date.now()}`,
    filiereId: input.filiereId,
    filiere: input.filiere,
    annee: input.annee,
    niveau: input.niveauAlias,
    niveauLabel: input.niveauLabel,
    classeId: input.classeId,
    classe: input.classe,
    semestreId: input.semestreId,
    semestre: input.semestreLabel,
    effectuePar: input.effectuePar,
    dateDeliberation: new Date().toISOString(),
    statut: "en_cours",
    lignes,
  };
  store.deliberations.unshift(record);
  persist();
  return record;
}

/** Corrige manuellement la décision d'un étudiant avant clôture — jamais après (la délibération
 * doit d'abord être rouverte). La décision automatique reste tracée dans decisionAuto. */
export function overrideDecision(deliberationId: string, etudiantId: string, decision: DecisionJury, raison: string, modifiePar: string): void {
  const deliberation = getDeliberationById(deliberationId);
  if (!deliberation || deliberation.statut === "cloturee") return;
  const ligne = deliberation.lignes.find((l) => l.etudiantId === etudiantId);
  if (!ligne) return;
  ligne.decisionFinale = decision;
  ligne.overrideRaison = decision === ligne.decisionAuto ? undefined : raison;
  ligne.overrideModifiePar = decision === ligne.decisionAuto ? undefined : modifiePar;
  persist();
}

export function cloturerDeliberation(id: string): void {
  const deliberation = getDeliberationById(id);
  if (!deliberation) return;
  deliberation.statut = "cloturee";
  persist();
}

/** Réouvre une délibération clôturée — passage en statut "reouverte", à nouveau modifiable et
 * rechargeable (mais le fait qu'elle ait été clôturée puis rouverte reste visible dans le statut,
 * jamais silencieusement effacé). */
export function reouvrirDeliberation(id: string): void {
  const deliberation = getDeliberationById(id);
  if (!deliberation) return;
  deliberation.statut = "reouverte";
  persist();
}
