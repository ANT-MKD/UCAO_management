import { ecrireStockage } from "@/lib/stockageLocal";
import { FILIERES } from "./mockData";
import { getFilieres, subscribeFilieres } from "./filiereStore";
import { getMethodesCalculActivesParNiveau } from "./bulletinMethodesStore";

const STORAGE_KEY = "edumanage-scolarite-config-v1";

/** Codes de repli si aucune méthode n'est configurée pour la filière — reproduisent exactement
 * le calcul jusque-là câblé en dur dans bulletinEngine.ts, pour ne rien changer aux bulletins
 * déjà produits tant que l'admin n'a rien reconfiguré. */
const METHODE_DEFAUT: Record<"moyenneUe" | "moyenneSession" | "moyenneAnnee" | "moyenneProgramme", string> = {
  moyenneUe: "calculMoyenneCredit",
  moyenneSession: "calculMoyenneCredit",
  moyenneAnnee: "calculMoyenneCredit",
  moyenneProgramme: "calculMoyenneDefault",
};

export type RegleRattrapage = "remplace" | "meilleure" | "plafonnee";

/** Règles de calcul que chaque établissement fixe selon son règlement des études. */
export interface ReglesCalcul {
  /** Moyenne minimale pour valider un EC (et obtenir ses crédits). */
  seuilValidationEc: number;
  /** Moyenne minimale pour valider une UE. */
  seuilValidationUe: number;
  /** Note plancher d'un EC : en dessous, l'UE n'est pas validée même si sa moyenne l'est
   * (pas de compensation). 0 = aucune note plancher. */
  noteEliminatoireEc: number;
  /** Semestre validé par compensation (moyenne ≥ moyenne de passage, aucune note sous le plancher) :
   * tous les crédits du semestre sont acquis, y compris ceux des UE non validées. */
  creditsParCompensation: boolean;
  /** Poids du contrôle continu (devoirs) quand aucune évaluation n'a fixé de poids — l'examen prend le reste. */
  poidsDevoirDefaut: number;
  /** Note de rattrapage : remplace l'examen, garde la meilleure des deux, ou remplace mais plafonnée. */
  regleRattrapage: RegleRattrapage;
  /** Plafond de la note de rattrapage retenue (règle « plafonnée »). */
  plafondRattrapage: number;
  /** Heures d'absence non justifiées au-delà desquelles le jury prononce l'exclusion. 0 = jamais. */
  heuresAbsenceExclusion: number;
  /** Écart sous la moyenne de passage qui ouvre le droit au rattrapage (ex. 2 points : de 8 à 9,99). */
  margeRattrapage: number;
}

/** Valeurs d'origine d'EduManage : les appliquer ne change rien aux résultats existants. */
export const REGLES_CALCUL_DEFAUT: ReglesCalcul = {
  seuilValidationEc: 10,
  seuilValidationUe: 10,
  noteEliminatoireEc: 0,
  creditsParCompensation: false,
  poidsDevoirDefaut: 30,
  regleRattrapage: "remplace",
  plafondRattrapage: 10,
  heuresAbsenceExclusion: 10,
  margeRattrapage: 2,
};

export interface ScolariteConfigRecord {
  id: string;
  filiereId: string;
  filiere: string;
  noteBareme: number;
  /** Méthode calcul bulletin : true = BulletinLMD (validation par cumul de crédits), false =
   * BulletinNonLMD (validation classique, uniquement par moyenne). Consommé par les règles de
   * validation (délibérations). */
  cumulCredit: boolean;
  moyennePassage: number;
  moyenneEliminatoire: number;
  /** Méthode de calcul de la moyenne d'UE — référence un MethodeCalculRecord (niveau "moyenneUe").
   * Non renseigné = repli sur le calcul historique (pondération par crédits). */
  methodeCalculMoyUeId?: string;
  /** Méthode de calcul de la moyenne de session — référence un MethodeCalculRecord (niveau "moyenneSession"). */
  methodeCalculMoySessionId?: string;
  /** Méthode de calcul de la moyenne annuelle — référence un MethodeCalculRecord (niveau "moyenneAnnee"). */
  methodeCalculMoyAnneeId?: string;
  /** Méthode de calcul de la moyenne de programme — référence un MethodeCalculRecord (niveau "moyenneProgramme"). */
  methodeCalculMoyProgrammeId?: string;
  /** Calcule et affiche un grade lettré (A/B/C...) en plus de la moyenne numérique sur les bulletins.
   * Optionnel : les configurations persistées avant l'ajout de ce champ retombent sur `false`. */
  calculGrade?: boolean;
  /** Règles de calcul propres à la filière (seuils, rattrapage, compensation…). Chaque règle absente
   * prend sa valeur par défaut (REGLES_CALCUL_DEFAUT), qui reproduit le comportement d'origine. */
  reglesCalcul?: Partial<ReglesCalcul>;
  modifiePar?: string;
  modifieLe?: string;
}

/** Résout le code technique (lib/bulletinCalculs.ts) réellement appliqué pour une filière et un
 * niveau donnés — retombe sur le comportement historique si rien n'est configuré, ou si la
 * méthode référencée a été désactivée entre-temps. */
export function resolveCodeMethodeCalcul(
  config: ScolariteConfigRecord | undefined,
  niveau: "moyenneUe" | "moyenneSession" | "moyenneAnnee" | "moyenneProgramme",
): string {
  const idField = ({
    moyenneUe: "methodeCalculMoyUeId",
    moyenneSession: "methodeCalculMoySessionId",
    moyenneAnnee: "methodeCalculMoyAnneeId",
    moyenneProgramme: "methodeCalculMoyProgrammeId",
  } as const)[niveau];
  const id = config?.[idField];
  if (id) {
    const actives = getMethodesCalculActivesParNiveau(niveau);
    const methode = actives.find((m) => m.id === id);
    if (methode) return methode.code;
  }
  return METHODE_DEFAUT[niveau];
}

export interface ValeursParDefaut {
  noteBareme: number;
  cumulCredit: boolean;
  moyennePassage: number;
  moyenneEliminatoire: number;
  modifiePar?: string;
  modifieLe?: string;
}

const DEFAUT: ValeursParDefaut = { noteBareme: 20, cumulCredit: true, moyennePassage: 10, moyenneEliminatoire: 0 };

function configPour(f: { id: string; nom: string }, valeurs: ValeursParDefaut = DEFAUT): ScolariteConfigRecord {
  return {
    id: `scol-cfg-${f.id}`,
    filiereId: f.id,
    filiere: f.nom,
    noteBareme: valeurs.noteBareme,
    cumulCredit: valeurs.cumulCredit,
    moyennePassage: valeurs.moyennePassage,
    moyenneEliminatoire: valeurs.moyenneEliminatoire,
    calculGrade: false,
  };
}

function seedConfigs(): ScolariteConfigRecord[] {
  return FILIERES.map((f) => configPour(f));
}

interface Persisted {
  configs: ScolariteConfigRecord[];
  valeursParDefaut: ValeursParDefaut;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): Persisted {
  if (typeof window === "undefined") return { configs: seedConfigs(), valeursParDefaut: DEFAUT };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { configs: seedConfigs(), valeursParDefaut: DEFAUT };
    return JSON.parse(raw) as Persisted;
  } catch {
    return { configs: seedConfigs(), valeursParDefaut: DEFAUT };
  }
}

let store: Persisted = load();

/** Toute filière créée après l'installation reçoit aussitôt sa configuration (valeurs par défaut
 * de l'établissement) — sans attendre un rechargement de la page. */
function completerFilieres() {
  const manquantes = getFilieres().filter((f) => !store.configs.some((c) => c.filiereId === f.id));
  if (manquantes.length === 0) return;
  store.configs = [...store.configs, ...manquantes.map((f) => configPour(f, store.valeursParDefaut ?? DEFAUT))];
  persist();
}

function persist() {
  store = { ...store, configs: store.configs.slice() };
  if (typeof window !== "undefined") {
    ecrireStockage(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

completerFilieres();
subscribeFilieres(completerFilieres);

export function subscribeScolariteConfigs(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getScolariteConfigs(): ScolariteConfigRecord[] {
  return store.configs;
}

export function getValeursParDefaut(): ValeursParDefaut {
  return store.valeursParDefaut;
}

export function getConfigForFiliere(filiereId: string): ScolariteConfigRecord | undefined {
  return store.configs.find((c) => c.filiereId === filiereId);
}

/** Règles de calcul effectives d'une filière (valeurs configurées, sinon valeurs par défaut). */
export function reglesDeCalcul(filiereId: string | undefined): ReglesCalcul {
  const config = filiereId ? store.configs.find((c) => c.filiereId === filiereId) : undefined;
  return { ...REGLES_CALCUL_DEFAUT, ...(config?.reglesCalcul ?? {}) };
}

/** Motif du refus si des règles de calcul sont incohérentes, sinon null. */
export function validerReglesCalcul(r: ReglesCalcul, bareme = 20): string | null {
  const dansBareme = (v: number) => Number.isFinite(v) && v >= 0 && v <= bareme;
  if (!dansBareme(r.seuilValidationEc) || !dansBareme(r.seuilValidationUe)) return `Les seuils de validation doivent être compris entre 0 et ${bareme}.`;
  if (!dansBareme(r.noteEliminatoireEc)) return `La note plancher doit être comprise entre 0 et ${bareme}.`;
  if (r.noteEliminatoireEc > r.seuilValidationUe) return "La note plancher ne peut pas dépasser le seuil de validation de l'UE.";
  if (!(r.poidsDevoirDefaut >= 0 && r.poidsDevoirDefaut <= 100)) return "Le poids du contrôle continu doit être compris entre 0 et 100 %.";
  if (!dansBareme(r.plafondRattrapage)) return `Le plafond du rattrapage doit être compris entre 0 et ${bareme}.`;
  if (!(r.heuresAbsenceExclusion >= 0)) return "Le nombre d'heures d'absence doit être positif (0 = jamais d'exclusion).";
  if (!(r.margeRattrapage >= 0 && r.margeRattrapage <= bareme)) return "La marge de rattrapage doit être positive.";
  return null;
}

export function updateReglesCalcul(id: string, regles: ReglesCalcul, modifiePar: string): { ok: boolean; reason?: string } {
  const config = store.configs.find((c) => c.id === id);
  if (!config) return { ok: false, reason: "Filière introuvable." };
  const motif = validerReglesCalcul(regles, config.noteBareme || 20);
  if (motif) return { ok: false, reason: motif };
  store.configs = store.configs.map((c) => (c.id === id ? { ...c, reglesCalcul: { ...regles }, modifiePar, modifieLe: new Date().toISOString() } : c));
  persist();
  return { ok: true };
}

export interface ScolariteConfigPatch {
  noteBareme: number;
  cumulCredit: boolean;
  moyennePassage: number;
  moyenneEliminatoire: number;
}

export function updateScolariteConfig(id: string, patch: ScolariteConfigPatch, modifiePar: string): void {
  const modifieLe = new Date().toISOString().slice(0, 10);
  store.configs = store.configs.map((c) => (c.id === id ? { ...c, ...patch, modifiePar, modifieLe } : c));
  persist();
}

export function appliquerValeursParDefaut(id: string, modifiePar: string): void {
  const { noteBareme, cumulCredit, moyennePassage, moyenneEliminatoire } = store.valeursParDefaut;
  updateScolariteConfig(id, { noteBareme, cumulCredit, moyennePassage, moyenneEliminatoire }, modifiePar);
}

export function updateValeursParDefaut(patch: ScolariteConfigPatch, modifiePar: string): void {
  store.valeursParDefaut = { ...patch, modifiePar, modifieLe: new Date().toISOString().slice(0, 10) };
  persist();
}

export interface MethodesCalculPatch {
  methodeCalculMoyUeId?: string;
  methodeCalculMoySessionId?: string;
  methodeCalculMoyAnneeId?: string;
  methodeCalculMoyProgrammeId?: string;
  calculGrade: boolean;
}

/** Met à jour uniquement le mapping des méthodes de calcul d'un programme (filière) — écran
 * "Méthodes de calcul d'un programme" du Paramétrage bulletin, distinct du formulaire historique
 * de scolarité (barème/passage/éliminatoire). */
export function updateMethodesCalculFiliere(id: string, patch: MethodesCalculPatch, modifiePar: string): void {
  const modifieLe = new Date().toISOString().slice(0, 10);
  store.configs = store.configs.map((c) => (c.id === id ? { ...c, ...patch, modifiePar, modifieLe } : c));
  persist();
}
