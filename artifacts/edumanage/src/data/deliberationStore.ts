import { computeBulletinPourClasse } from "./bulletinEngine";
import { getHeuresAbsenceNonJustifieePourEtudiant } from "./assiduiteEngine";
import { decideValidation, type RegleValidationRecord } from "./reglesValidationStore";
import { detecterDeclassementEtudiant, type RaisonDeclassement } from "./declassementEngine";

const STORAGE_KEY = "edumanage-deliberation-store-v1";

export type DecisionJury = "admis" | "ajourne" | "rattrapage" | "exclu" | "a_declasser";

/** Libellés canoniques des décisions de jury — source unique réutilisée partout où une décision
 * doit être affichée (Délibération, Attestations, Relevés) pour ne jamais diverger. */
export const DECISION_LABELS: Record<DecisionJury, string> = {
  admis: "Admis",
  ajourne: "Ajourné",
  rattrapage: "Rattrapage",
  exclu: "Exclu",
  a_declasser: "À déclasser",
};

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
  /** Seuil de moyenne de passage retenu pour CETTE session (péréquation) — remplace
   * regle.moyennePassage uniquement pour cette délibération, jamais le paramétrage global.
   * Absent = seuil standard de la règle de validation appliqué tel quel. */
  seuilOverride?: number;
  seuilOverrideRaison?: string;
  seuilOverrideModifiePar?: string;
  seuilOverrideModifieLe?: string;
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

function calculerLigne(e: EtudiantPourDeliberation, input: ChargerDeliberationInput, seuilEffectif?: number): DeliberationLigne {
  const bulletin = computeBulletinPourClasse(e.id, input.classeId, input.semestreAlias);
  const moyenne = bulletin?.moyenneSession ?? 0;
  const absences = getHeuresAbsenceNonJustifieePourEtudiant(e.id, input.classeId, input.semestreAlias);

  const declassement = detecterDeclassementEtudiant(e.id, input.classeId, input.filiereId, input.niveauAlias, input.annee, input.semestreAlias);
  const regleEffective = seuilEffectif !== undefined ? { ...input.regle, moyennePassage: seuilEffectif } : input.regle;
  const decisionAuto: DecisionJury = declassement ? "a_declasser" : decideValidation(moyenne, bulletin?.creditsObtenus ?? 0, absences, regleEffective);

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
  // Un seuil de session déjà ajusté (péréquation) reste appliqué au rechargement — recharger ne
  // doit jamais revenir silencieusement au seuil standard de la règle de validation.
  const seuilEffectif = existing?.seuilOverride;

  const lignes = input.etudiants.map((e) => {
    const ligne = calculerLigne(e, input, seuilEffectif);
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
    id: `delib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

/** Ajuste le seuil de moyenne de passage retenu pour CETTE session de délibération uniquement
 * (péréquation) — jamais le paramétrage global (regle.moyennePassage, Paramétrage bulletins).
 * Recalcule decisionAuto de chaque ligne non déclassée avec le nouveau seuil ; une décision déjà
 * corrigée manuellement par le jury (decisionFinale !== ancien decisionAuto) n'est jamais écrasée.
 * Le seuil et son motif restent tracés sur la délibération pour toute relecture ultérieure. */
export function ajusterSeuilSession(
  deliberationId: string,
  nouveauSeuil: number,
  raison: string,
  modifiePar: string,
  regle: RegleValidationRecord,
): void {
  const deliberation = getDeliberationById(deliberationId);
  if (!deliberation || deliberation.statut === "cloturee") return;
  const regleAjustee: RegleValidationRecord = { ...regle, moyennePassage: nouveauSeuil };
  deliberation.lignes = deliberation.lignes.map((ligne) => {
    if (ligne.decisionAuto === "a_declasser") return ligne;
    const manuellementCorrigee = ligne.decisionFinale !== ligne.decisionAuto;
    const decisionAuto = decideValidation(ligne.moyenne, ligne.creditsObtenus, ligne.absences, regleAjustee);
    return { ...ligne, decisionAuto, decisionFinale: manuellementCorrigee ? ligne.decisionFinale : decisionAuto };
  });
  deliberation.seuilOverride = nouveauSeuil;
  deliberation.seuilOverrideRaison = raison;
  deliberation.seuilOverrideModifiePar = modifiePar;
  deliberation.seuilOverrideModifieLe = new Date().toISOString();
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
