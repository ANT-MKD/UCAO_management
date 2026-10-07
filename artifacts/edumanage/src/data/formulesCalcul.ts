import { compilerFormule, calculerFormule, ErreurFormule, normaliserNom, type Valeur } from "@/lib/formules";
import type { DecisionJury } from "./deliberationStore";
import type { DecisionAnnuelle } from "./deliberationAnnuelleStore";

/** Les six étapes du calcul qu'une filière peut écrire elle-même sous forme de formule. Sans
 * formule, l'étape suit les réglages de la filière (Paramétrage scolarité, Paramétrage bulletins). */
export type CleFormule = "noteEc" | "moyenneUe" | "creditsUe" | "moyenneSemestre" | "decisionSemestre" | "decisionAnnee";
export type FormulesCalcul = Partial<Record<CleFormule, string>>;

export interface VariableFormule {
  nom: string;
  description: string;
  /** Valeur de l'exemple (Awa) — sert au test de l'écran et à la vérification à l'enregistrement. */
  exemple: Valeur;
}

export interface EtapeFormule {
  cle: CleFormule;
  titre: string;
  question: string;
  resultat: "nombre" | "credits" | "decisionSemestre" | "decisionAnnee";
  aideResultat: string;
  variables: VariableFormule[];
}

const v = (nom: string, description: string, exemple: Valeur): VariableFormule => ({ nom, description, exemple });

export const ETAPES_FORMULES: EtapeFormule[] = [
  {
    cle: "noteEc", titre: "Note d'une matière (EC)", question: "Comment calculer la moyenne d'une matière ?",
    resultat: "nombre", aideResultat: "Un nombre sur 20.",
    variables: [
      v("DEVOIR", "Note de contrôle continu (moyenne des devoirs selon leurs poids)", 14),
      v("EXAMEN", "Note de l'examen de la session normale", 12),
      v("RATTRAPAGE", "Note de rattrapage (vide s'il n'y en a pas)", undefined),
      v("EXAMEN_RETENU", "Note d'examen retenue après rattrapage, selon la règle de la filière", 12),
      v("POIDS_DEVOIR", "Poids des devoirs (ex. 0,3), fixé à la création des évaluations", 0.3),
      v("POIDS_EXAMEN", "Poids de l'examen (ex. 0,7)", 0.7),
      v("CREDITS_MATIERE", "Crédits de la matière", 5),
      v("COEFF_MATIERE", "Coefficient de la matière", 1),
    ],
  },
  {
    cle: "moyenneUe", titre: "Moyenne d'une UE", question: "Comment calculer la moyenne d'une unité d'enseignement ?",
    resultat: "nombre", aideResultat: "Un nombre sur 20.",
    variables: [
      v("MATIERES", "Liste des moyennes des matières de l'UE (déjà notées)", [12.6, 7.3]),
      v("CREDITS_MATIERES", "Liste des crédits de ces matières (même ordre)", [6, 4]),
      v("COEFF_MATIERES", "Liste des coefficients de ces matières (même ordre)", [1, 1]),
      v("NB_MATIERES", "Nombre de matières de l'UE (notées ou non)", 2),
      v("CREDITS_UE", "Crédits de l'UE", 10),
    ],
  },
  {
    cle: "creditsUe", titre: "Crédits obtenus dans une UE", question: "Combien de crédits l'étudiant gagne-t-il dans l'UE ?",
    resultat: "credits", aideResultat: "Un nombre de crédits (l'UE est acquise s'il les a tous), ou VRAI/FAUX (VRAI = tous les crédits).",
    variables: [
      v("MOYENNE_UE", "Moyenne de l'UE", 9.95),
      v("CREDITS_UE", "Crédits de l'UE", 10),
      v("MATIERES", "Liste des moyennes des matières de l'UE", [12.6, 7.3]),
      v("NOTE_MIN", "Plus petite moyenne de matière de l'UE", 7.3),
      v("NB_MATIERES", "Nombre de matières de l'UE", 2),
    ],
  },
  {
    cle: "moyenneSemestre", titre: "Moyenne du semestre", question: "Comment calculer la moyenne du semestre ?",
    resultat: "nombre", aideResultat: "Un nombre sur 20.",
    variables: [
      v("MATIERES_SEMESTRE", "Liste des moyennes de toutes les matières du semestre", [12.6, 7.3, 15, 15, 15, 15]),
      v("CREDITS_MATIERES_SEMESTRE", "Liste des crédits de ces matières (même ordre)", [5, 5, 5, 5, 5, 5]),
      v("UES", "Liste des moyennes des UE du semestre", [9.95, 15, 15]),
      v("CREDITS_UES", "Liste des crédits de ces UE (même ordre)", [10, 10, 10]),
      v("CREDITS_SEMESTRE", "Crédits obtenus dans le semestre", 20),
    ],
  },
  {
    cle: "decisionSemestre", titre: "Décision du semestre", question: "Quand le semestre est-il validé ?",
    resultat: "decisionSemestre", aideResultat: "VRAI/FAUX, ou un texte : « VALIDÉ », « NON VALIDÉ », « RATTRAPAGE » ou « EXCLU ».",
    variables: [
      v("CREDITS_SEMESTRE", "Crédits obtenus dans le semestre", 20),
      v("CREDITS_TOTAL_SEMESTRE", "Crédits du semestre (en général 30)", 30),
      v("MOYENNE_SEMESTRE", "Moyenne du semestre", 13.31),
      v("ABSENCES", "Heures d'absence non justifiées du semestre", 0),
      v("UE_NON_ACQUISES", "Nombre d'UE non acquises", 1),
    ],
  },
  {
    cle: "decisionAnnee", titre: "Décision de l'année", question: "Qui passe en classe supérieure ?",
    resultat: "decisionAnnee", aideResultat: "VRAI/FAUX, ou un texte : « ADMIS », « ADMIS AVEC DETTE », « REDOUBLE » ou « EXCLU ».",
    variables: [
      v("CREDITS_ANNEE", "Crédits obtenus sur l'année (les deux semestres)", 50),
      v("CREDITS_TOTAL_ANNEE", "Crédits de l'année (en général 60)", 60),
      v("CREDITS_S1", "Crédits obtenus au premier semestre de l'année", 20),
      v("CREDITS_S2", "Crédits obtenus au second semestre de l'année", 30),
      v("MOYENNE_S1", "Moyenne du premier semestre", 13.31),
      v("MOYENNE_S2", "Moyenne du second semestre", 14),
      v("ABSENCES", "Heures d'absence non justifiées de l'année", 0),
      v("UE_NON_ACQUISES", "Nombre d'UE non acquises sur l'année", 1),
    ],
  },
];

export const etapeFormule = (cle: CleFormule) => ETAPES_FORMULES.find((e) => e.cle === cle)!;
export const nomsVariables = (cle: CleFormule) => etapeFormule(cle).variables.map((x) => x.nom);
export const exempleEtape = (cle: CleFormule): Record<string, Valeur> =>
  Object.fromEntries(etapeFormule(cle).variables.map((x) => [x.nom, x.exemple]));

// ------------------------------------------------------------------ Interprétation des résultats

const texteDecision = (s: string) => normaliserNom(s).replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();

export function interpreterDecisionSemestre(r: Valeur): DecisionJury | undefined {
  if (typeof r === "boolean") return r ? "admis" : "ajourne";
  if (typeof r !== "string") return undefined;
  const t = texteDecision(r);
  if (t.includes("EXCLU")) return "exclu";
  if (t.includes("RATTRAP")) return "rattrapage";
  if (t.includes("NON VALID") || t.includes("AJOURN") || t.includes("NON ACQUIS") || t.includes("NON ADMIS")) return "ajourne";
  if (t.includes("VALID") || t.includes("ADMIS") || t.includes("ACQUIS")) return "admis";
  return undefined;
}

export function interpreterDecisionAnnee(r: Valeur): DecisionAnnuelle | undefined {
  if (typeof r === "boolean") return r ? "admis" : "redouble";
  if (typeof r !== "string") return undefined;
  const t = texteDecision(r);
  if (t.includes("EXCLU")) return "exclu";
  if (t.includes("DETTE") || t.includes("AJAC") || t.includes("CONDITIONNEL")) return "admis_avec_dette";
  if (t.includes("REDOUBL") || t.includes("NON VALID") || t.includes("AJOURN") || t.includes("NON ADMIS")) return "redouble";
  if (t.includes("ADMIS") || t.includes("VALID") || t.includes("PASSE")) return "admis";
  return undefined;
}

/** Crédits obtenus selon le résultat de la formule « Crédits obtenus dans une UE ». */
export function interpreterCredits(r: Valeur, creditsUe: number): number | undefined {
  if (r === undefined) return undefined;
  if (typeof r === "boolean") return r ? creditsUe : 0;
  if (typeof r === "number" && Number.isFinite(r)) return Math.max(0, Math.min(creditsUe, r));
  return undefined;
}

// ------------------------------------------------------------------ Vérification et calcul

export interface ResultatFormule {
  ok: boolean;
  /** Valeur brute de la formule (nombre, texte, VRAI/FAUX) — vide si une note manque. */
  valeur?: Valeur;
  /** Libellé lisible du résultat : « 12,60 », « Semestre non validé »… */
  libelle?: string;
  erreur?: string;
  position?: number;
}

const LIBELLES_SEMESTRE: Record<DecisionJury, string> = { admis: "Semestre validé", ajourne: "Semestre non validé", rattrapage: "Rattrapage", exclu: "Exclu", a_declasser: "À déclasser" };
const LIBELLES_ANNEE: Record<DecisionAnnuelle, string> = { admis: "Admis", admis_avec_dette: "Admis avec dette", redouble: "Redouble", exclu: "Exclu" };

function libelleResultat(cle: CleFormule, valeur: Valeur, contexte: Record<string, Valeur>): { libelle?: string; erreur?: string } {
  const etape = etapeFormule(cle);
  if (valeur === undefined) return { libelle: "En attente (une note n'est pas encore saisie)" };
  switch (etape.resultat) {
    case "nombre":
      if (typeof valeur !== "number" || !Number.isFinite(valeur)) return { erreur: `Le résultat doit être un nombre (obtenu : ${String(valeur)}).` };
      return { libelle: valeur.toFixed(2).replace(".", ",") };
    case "credits": {
      const credits = typeof contexte.CREDITS_UE === "number" ? contexte.CREDITS_UE : 0;
      const c = interpreterCredits(valeur, credits);
      if (c === undefined) return { erreur: `Le résultat doit être un nombre de crédits ou VRAI/FAUX (obtenu : ${String(valeur)}).` };
      return { libelle: `${c} crédit(s) sur ${credits} — ${c >= credits && credits > 0 ? "UE acquise" : "UE non acquise"}` };
    }
    case "decisionSemestre": {
      const d = interpreterDecisionSemestre(valeur);
      return d ? { libelle: LIBELLES_SEMESTRE[d] } : { erreur: `« ${String(valeur)} » n'est pas une décision reconnue. ${etape.aideResultat}` };
    }
    case "decisionAnnee": {
      const d = interpreterDecisionAnnee(valeur);
      return d ? { libelle: LIBELLES_ANNEE[d] } : { erreur: `« ${String(valeur)} » n'est pas une décision reconnue. ${etape.aideResultat}` };
    }
  }
}

/** Calcule une formule sur des valeurs données (test de l'écran ou exemple d'Awa). */
export function essayerFormule(cle: CleFormule, texte: string, contexte: Record<string, Valeur> = exempleEtape(cle)): ResultatFormule {
  try {
    const f = compilerFormule(texte, nomsVariables(cle));
    const valeur = calculerFormule(f, contexte);
    const { libelle, erreur } = libelleResultat(cle, valeur, contexte);
    return erreur ? { ok: false, valeur, erreur } : { ok: true, valeur, libelle };
  } catch (e) {
    if (e instanceof ErreurFormule) return { ok: false, erreur: e.message, position: e.position };
    return { ok: false, erreur: "Formule incorrecte." };
  }
}

/** Une formule ne s'enregistre que si elle se calcule sans erreur sur l'exemple, et ne plante pas
 * quand des notes manquent (elle doit alors simplement rester « en attente »). */
export function validerFormule(cle: CleFormule, texte: string): string | null {
  if (!texte.trim()) return null;
  const essai = essayerFormule(cle, texte);
  if (!essai.ok) return essai.erreur ?? "Formule incorrecte.";
  const vide = Object.fromEntries(etapeFormule(cle).variables.map((x) => [x.nom, Array.isArray(x.exemple) ? [] : x.nom.startsWith("CREDITS") || x.nom.startsWith("NB") || x.nom.startsWith("POIDS") ? x.exemple : undefined]));
  const essaiVide = essayerFormule(cle, texte, vide);
  if (!essaiVide.ok && essaiVide.valeur === undefined && essaiVide.erreur) {
    return `Quand une note n'est pas encore saisie, la formule échoue : ${essaiVide.erreur}`;
  }
  return null;
}

/** Calcule une formule dans le moteur des bulletins. Une formule vérifiée à l'enregistrement ne
 * devrait jamais échouer ; si cela arrive, le résultat reste vide (« en attente ») plutôt que faux. */
export function executerFormule(cle: CleFormule, texte: string, contexte: Record<string, Valeur>): Valeur {
  try {
    return calculerFormule(compilerFormule(texte, nomsVariables(cle)), contexte);
  } catch (e) {
    if (typeof console !== "undefined") console.warn(`Formule « ${cle} » : ${(e as Error).message}`);
    return undefined;
  }
}
