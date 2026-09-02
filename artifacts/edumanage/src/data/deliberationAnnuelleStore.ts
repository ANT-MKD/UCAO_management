import { computeBulletin, computeMoyenneAnnuelle } from "./bulletinEngine";
import { getHeuresAbsenceNonJustifieePourEtudiant } from "./assiduiteEngine";
import { type RegleValidationRecord } from "./reglesValidationStore";
import { type NiveauRecord } from "./niveauStore";
import { creerCreditDette } from "./creditDetteStore";

const STORAGE_KEY = "edumanage-deliberation-annuelle-store-v1";

export type DecisionAnnuelle = "admis" | "admis_avec_dette" | "redouble" | "exclu";

/** Libellés canoniques des décisions de délibération annuelle — source unique réutilisée partout
 * où une décision annuelle doit être affichée. */
export const DECISION_ANNUELLE_LABELS: Record<DecisionAnnuelle, string> = {
  admis: "Admis",
  admis_avec_dette: "Admis avec dette (AJAC)",
  redouble: "Redouble",
  exclu: "Exclu",
};

export interface UeNonValideeAnnuelle {
  ueId: string;
  ueCode: string;
  ueLibelle: string;
  ueCredits: number;
  semestreAlias: string;
}

export interface DeliberationAnnuelleLigne {
  etudiantId: string;
  etudiant: string;
  matricule: string;
  moyenneAnnuelle: number;
  creditsObtenus: number;
  creditsTotal: number;
  uesNonValidees: UeNonValideeAnnuelle[];
  decisionAuto: DecisionAnnuelle;
  decisionFinale: DecisionAnnuelle;
  overrideRaison?: string;
  overrideModifiePar?: string;
}

export interface DeliberationAnnuelleRecord {
  id: string;
  filiereId: string;
  filiere: string;
  annee: string;
  niveauId: string;
  niveau: string;
  niveauLabel: string;
  classeId: string;
  classe: string;
  effectuePar: string;
  dateDeliberation: string;
  statut: "en_cours" | "cloturee" | "reouverte";
  lignes: DeliberationAnnuelleLigne[];
}

interface Persisted {
  deliberations: DeliberationAnnuelleRecord[];
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

export function subscribeDeliberationsAnnuelles(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDeliberationsAnnuelles(): DeliberationAnnuelleRecord[] {
  return store.deliberations;
}

export function getDeliberationAnnuelleById(id: string): DeliberationAnnuelleRecord | undefined {
  return store.deliberations.find((d) => d.id === id);
}

/** Une classe est propre à une année (CLASSES a un champ "annee") donc filière+niveau+année en
 * découlent déjà — le classeId suffit comme clé, exactement comme deliberationStore.ts utilise
 * classeId+semestreId (ici sans axe semestre puisque c'est un bilan de l'année entière). */
export function getDeliberationAnnuelleForClasse(classeId: string): DeliberationAnnuelleRecord | undefined {
  return store.deliberations.find((d) => d.classeId === classeId);
}

/** Décision annuelle réelle : combine le seuil de crédit/moyenne de la règle "année" (comme
 * decideValidation le fait pour un semestre) avec la tolérance de passage conditionnel (AJAC)
 * propre au niveau quitté — jamais la même chose que decideValidation, qui ignore l'existence
 * même d'une dette de crédits. */
function decideValidationAnnuelle(
  moyenne: number,
  creditsObtenus: number,
  absencesHeures: number,
  regle: RegleValidationRecord,
  niveau: NiveauRecord | undefined,
): DecisionAnnuelle {
  if (absencesHeures > 10) return "exclu";
  if (regle.moyenneEliminatoire > 0 && moyenne < regle.moyenneEliminatoire) return "exclu";

  const okMoyenne = !regle.validationParMoyenne || moyenne >= regle.moyennePassage;
  const okCredit = !regle.validationParCredit || creditsObtenus >= regle.creditPassage;
  if (okMoyenne && okCredit) return "admis";

  if (niveau?.passageConditionnelAutorise && creditsObtenus >= (niveau.creditDetteMin ?? 0)) return "admis_avec_dette";
  return "redouble";
}

export interface EtudiantPourDeliberationAnnuelle {
  id: string;
  prenom: string;
  nom: string;
  matricule: string;
}

export interface ChargerDeliberationAnnuelleInput {
  filiereId: string;
  filiere: string;
  annee: string;
  niveauId: string;
  niveauAlias: string;
  niveauLabel: string;
  niveau: NiveauRecord | undefined;
  classeId: string;
  classe: string;
  semestresAlias: string[];
  etudiants: EtudiantPourDeliberationAnnuelle[];
  regle: RegleValidationRecord;
  effectuePar: string;
}

function calculerLigneAnnuelle(e: EtudiantPourDeliberationAnnuelle, input: ChargerDeliberationAnnuelleInput): DeliberationAnnuelleLigne {
  const { moyenne, creditsObtenus, creditsTotal } = computeMoyenneAnnuelle(e.id, input.classeId, input.filiereId, input.niveauAlias);
  const absences = input.semestresAlias.reduce(
    (s, semestreAlias) => s + getHeuresAbsenceNonJustifieePourEtudiant(e.id, input.classeId, semestreAlias),
    0,
  );
  const uesNonValidees: UeNonValideeAnnuelle[] = input.semestresAlias.flatMap((semestreAlias) => {
    const bulletin = computeBulletin(e.id, input.classeId, input.filiereId, input.niveauAlias, semestreAlias);
    return bulletin.ues
      .filter((u) => !u.validee)
      .map((u): UeNonValideeAnnuelle => ({ ueId: u.id, ueCode: u.code, ueLibelle: u.libelle, ueCredits: u.credits, semestreAlias }));
  });

  const decisionAuto = decideValidationAnnuelle(moyenne ?? 0, creditsObtenus, absences, input.regle, input.niveau);

  return {
    etudiantId: e.id,
    etudiant: `${e.prenom} ${e.nom}`,
    matricule: e.matricule,
    moyenneAnnuelle: parseFloat((moyenne ?? 0).toFixed(2)),
    creditsObtenus,
    creditsTotal,
    uesNonValidees,
    decisionAuto,
    decisionFinale: decisionAuto,
  };
}

/** Crée (ou recharge) la délibération annuelle d'une classe — même logique que
 * chargerDeliberation() : recalcule les décisions à partir des vraies moyennes annuelles
 * actuelles, préserve les corrections manuelles déjà posées tant que non clôturée, jamais
 * recalculée après clôture (il faut la rouvrir explicitement). */
export function chargerDeliberationAnnuelle(input: ChargerDeliberationAnnuelleInput): DeliberationAnnuelleRecord {
  const existing = getDeliberationAnnuelleForClasse(input.classeId);
  if (existing && existing.statut === "cloturee") {
    return existing;
  }

  const overridesParEtudiant = new Map(
    (existing?.lignes ?? [])
      .filter((l) => l.decisionFinale !== l.decisionAuto)
      .map((l) => [l.etudiantId, l]),
  );

  const lignes = input.etudiants.map((e) => {
    const ligne = calculerLigneAnnuelle(e, input);
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

  const record: DeliberationAnnuelleRecord = {
    id: `delib-an-${Date.now()}`,
    filiereId: input.filiereId,
    filiere: input.filiere,
    annee: input.annee,
    niveauId: input.niveauId,
    niveau: input.niveauAlias,
    niveauLabel: input.niveauLabel,
    classeId: input.classeId,
    classe: input.classe,
    effectuePar: input.effectuePar,
    dateDeliberation: new Date().toISOString(),
    statut: "en_cours",
    lignes,
  };
  store.deliberations.unshift(record);
  persist();
  return record;
}

export function overrideDecisionAnnuelle(deliberationId: string, etudiantId: string, decision: DecisionAnnuelle, raison: string, modifiePar: string): void {
  const deliberation = getDeliberationAnnuelleById(deliberationId);
  if (!deliberation || deliberation.statut === "cloturee") return;
  const ligne = deliberation.lignes.find((l) => l.etudiantId === etudiantId);
  if (!ligne) return;
  ligne.decisionFinale = decision;
  ligne.overrideRaison = decision === ligne.decisionAuto ? undefined : raison;
  ligne.overrideModifiePar = decision === ligne.decisionAuto ? undefined : modifiePar;
  persist();
}

/** Clôture la délibération annuelle : pour chaque étudiant admis avec dette (AJAC), écrit une
 * dette de crédit par UE non validée dans creditDetteStore.ts — c'est le seul endroit qui crée
 * des dettes, jamais une saisie manuelle séparée qui risquerait de diverger de la vraie décision
 * du jury. Idempotent (creerCreditDette ne duplique jamais une dette encore active). */
export function cloturerDeliberationAnnuelle(id: string): void {
  const deliberation = getDeliberationAnnuelleById(id);
  if (!deliberation) return;
  for (const ligne of deliberation.lignes) {
    if (ligne.decisionFinale !== "admis_avec_dette") continue;
    for (const ue of ligne.uesNonValidees) {
      creerCreditDette({
        etudiantId: ligne.etudiantId,
        etudiant: ligne.etudiant,
        matricule: ligne.matricule,
        ueId: ue.ueId,
        ueCode: ue.ueCode,
        ueLibelle: ue.ueLibelle,
        ueCredits: ue.ueCredits,
        filiereId: deliberation.filiereId,
        filiere: deliberation.filiere,
        niveauOrigine: deliberation.niveau,
        niveauLabelOrigine: deliberation.niveauLabel,
        semestreOrigine: ue.semestreAlias,
        annee: deliberation.annee,
      });
    }
  }
  deliberation.statut = "cloturee";
  persist();
}

export function reouvrirDeliberationAnnuelle(id: string): void {
  const deliberation = getDeliberationAnnuelleById(id);
  if (!deliberation) return;
  deliberation.statut = "reouverte";
  persist();
}
