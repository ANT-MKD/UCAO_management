/** Fonctions réelles de calcul de moyenne pondérée, utilisées par le Paramétrage bulletin.
 * Chaque "méthode de calcul" configurée dans bulletinMethodesStore pointe vers l'une des clés
 * ci-dessous (par niveau) — jamais une méthode purement descriptive sans fonction associée :
 * changer la méthode sélectionnée pour une filière change réellement le résultat produit par
 * bulletinEngine.ts. */

export interface ElementPondere {
  /** Moyenne déjà calculée de l'élément (EC, UE, session, année) */
  moyenne: number;
  /** Crédits ECTS de l'élément */
  credits: number;
}

export type CalculMoyenneFn = (elements: ElementPondere[]) => number | undefined;

function valides(elements: ElementPondere[]): ElementPondere[] {
  return elements.filter((e) => Number.isFinite(e.moyenne));
}

/** Moyenne pondérée par les crédits ; retombe sur la moyenne simple si le total des crédits est
 * nul. */
function moyennePonderee(elements: ElementPondere[], poidsKey: "credits"): number | undefined {
  const els = valides(elements);
  if (els.length === 0) return undefined;
  const totalPoids = els.reduce((s, e) => s + (e[poidsKey] || 0), 0);
  if (totalPoids <= 0) return moyenneSimple(els);
  return els.reduce((s, e) => s + e.moyenne * (e[poidsKey] || 0), 0) / totalPoids;
}

/** Moyenne arithmétique simple, sans pondération. */
function moyenneSimple(elements: ElementPondere[]): number | undefined {
  const els = valides(elements);
  if (els.length === 0) return undefined;
  return els.reduce((s, e) => s + e.moyenne, 0) / els.length;
}

/** Somme brute des moyennes, sans division — tel que décrit par le système de référence pour
 * "calculMoyenneSommeMoyenne". Donne un résultat hors barème /20, à n'utiliser que si la filière
 * l'exige explicitement. */
function sommeMoyennes(elements: ElementPondere[]): number | undefined {
  const els = valides(elements);
  if (els.length === 0) return undefined;
  return els.reduce((s, e) => s + e.moyenne, 0);
}

/** "calculMoyenneProgrammeESMT" du système de référence : (moyenne classe préparatoire +
 * moyenne classe d'examen × 2) / 3. Le système de référence ne précise pas d'identifiant explicite
 * pour distinguer les deux classes ; on retient par convention la première année de la liste comme
 * classe préparatoire et la dernière comme classe d'examen (ordre chronologique des années fourni
 * par l'appelant). Avec une seule année, retombe sur sa moyenne simple. */
function moyenneProgrammeEsmt(elements: ElementPondere[]): number | undefined {
  const els = valides(elements);
  if (els.length === 0) return undefined;
  if (els.length === 1) return els[0].moyenne;
  const classePreparatoire = els[0];
  const classeExamen = els[els.length - 1];
  return (classePreparatoire.moyenne + classeExamen.moyenne * 2) / 3;
}

export const METHODES_MOYENNE_UE: Record<string, CalculMoyenneFn> = {
  calculMoyenneCredit: (els) => moyennePonderee(els, "credits"),
  calculMoyenneDefault: (els) => moyenneSimple(els),
  calculMoyenneSommeMoyenne: (els) => sommeMoyennes(els),
};

export const METHODES_MOYENNE_SESSION: Record<string, CalculMoyenneFn> = {
  /** Somme des moyennes de TOUS les EC du semestre ÷ nombre d'EC (règle UCAO) — le moteur lui
   * transmet les EC du semestre au lieu des UE (voir CODE_MOYENNE_EC_SEMESTRE). */
  calculMoyenneEcSemestre: (els) => moyenneSimple(els),
  calculMoyenneDefault: (els) => moyenneSimple(els),
  calculMoyenneCredit: (els) => moyennePonderee(els, "credits"),
  calculSessionMoyenneByUEAndCreditUE: (els) => moyennePonderee(els, "credits"),
  /** Spécifique Supdeco, non détaillée dans le système de référence — implémentée provisoirement
   * comme une moyenne pondérée par crédits ; à ajuster si la formule exacte est communiquée. */
  calculMoyenneMethodeSupdeco: (els) => moyennePonderee(els, "credits"),
};

export const METHODES_MOYENNE_ANNEE: Record<string, CalculMoyenneFn> = {
  calculMoyenneCredit: (els) => moyennePonderee(els, "credits"),
  calculMoyenneDefault: (els) => moyenneSimple(els),
};

export const METHODES_MOYENNE_PROGRAMME: Record<string, CalculMoyenneFn> = {
  calculMoyenneDefault: (els) => moyenneSimple(els),
  calculMoyenneProgrammeESMT: (els) => moyenneProgrammeEsmt(els),
};

/** Méthode de session calculée sur les EC du semestre plutôt que sur les UE. */
export const CODE_MOYENNE_EC_SEMESTRE = "calculMoyenneEcSemestre";

export type NiveauMethodeCalcul = "moyenneUe" | "moyenneSession" | "moyenneAnnee" | "moyenneProgramme";

const REGISTRES: Record<NiveauMethodeCalcul, Record<string, CalculMoyenneFn>> = {
  moyenneUe: METHODES_MOYENNE_UE,
  moyenneSession: METHODES_MOYENNE_SESSION,
  moyenneAnnee: METHODES_MOYENNE_ANNEE,
  moyenneProgramme: METHODES_MOYENNE_PROGRAMME,
};

/** Applique la méthode de calcul `code` du niveau donné. Si le code est inconnu ou non actif,
 * retombe sur "calculMoyenneDefault" (moyenne simple) plutôt que d'échouer silencieusement. */
export function appliquerMethodeCalcul(niveau: NiveauMethodeCalcul, code: string | undefined, elements: ElementPondere[]): number | undefined {
  const registre = REGISTRES[niveau];
  const fn = (code && registre[code]) || registre["calculMoyenneDefault"];
  return fn ? fn(elements) : moyenneSimple(elements);
}

export function getCodesMethodesDisponibles(niveau: NiveauMethodeCalcul): string[] {
  return Object.keys(REGISTRES[niveau]);
}
