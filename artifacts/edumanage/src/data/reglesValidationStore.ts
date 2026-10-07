import { reglesDeCalcul, getScolariteConfigs, subscribeScolariteConfigs } from "./scolariteConfigStore";
import { ecrireStockage } from "@/lib/stockageLocal";
import { atteint } from "@/lib/notes";
import { FILIERES } from "./mockData";

const STORAGE_KEY = "edumanage-regles-validation-store-v1";

export type TypeRegleValidation = "semestre" | "annee" | "programme";

export interface RegleValidationRecord {
  id: string;
  filiereId: string;
  filiere: string;
  type: TypeRegleValidation;
  validationParCredit: boolean;
  validationParMoyenne: boolean;
  /** C.P — crédits de passage requis quand validationParCredit est actif. */
  creditPassage: number;
  /** M.P — moyenne de passage requise quand validationParMoyenne est actif. */
  moyennePassage: number;
  moyenneEliminatoire: number;
  modifiePar?: string;
  modifieLe?: string;
}

/** Règles de l'UCAO (système LMD) : semestre validé avec ses 30 crédits, année validée avec 60
 * crédits, licence avec 180 — la validation se fait par les crédits, pas par la moyenne. */
const CREDITS_PAR_TYPE: Record<TypeRegleValidation, number> = { semestre: 30, annee: 60, programme: 180 };

/** Critères par défaut d'un type de règle. Une filière hors LMD (Paramétrage scolarité « Cumul
 * crédit » = Non) reste validée à la moyenne. */
function criteresParDefaut(filiereId: string, type: TypeRegleValidation): Pick<RegleValidationRecord, "validationParCredit" | "validationParMoyenne" | "creditPassage"> {
  const lmd = getScolariteConfigs().find((c) => c.filiereId === filiereId)?.cumulCredit ?? true;
  return lmd
    ? { validationParCredit: true, validationParMoyenne: false, creditPassage: CREDITS_PAR_TYPE[type] }
    : { validationParCredit: false, validationParMoyenne: true, creditPassage: 0 };
}

function reglesPour(f: { id: string; nom: string }): RegleValidationRecord[] {
  const config = getScolariteConfigs().find((c) => c.filiereId === f.id);
  const types: TypeRegleValidation[] = ["semestre", "annee", "programme"];
  return types.map((type): RegleValidationRecord => ({
      id: `regle-val-${f.id}-${type}`,
      filiereId: f.id,
      filiere: f.nom,
      type,
      ...criteresParDefaut(f.id, type),
      moyennePassage: config?.moyennePassage ?? 10,
      moyenneEliminatoire: config?.moyenneEliminatoire ?? 0,
    }));
}

function seed(): RegleValidationRecord[] {
  return FILIERES.flatMap(reglesPour);
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): RegleValidationRecord[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as RegleValidationRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seed();
    // Une règle jamais modifiée par un administrateur suit les critères par défaut en vigueur.
    return parsed.map((r) => (r.modifiePar ? r : { ...r, ...criteresParDefaut(r.filiereId, r.type) }));
  } catch {
    return seed();
  }
}

let store: RegleValidationRecord[] = load();

/** Suit Paramétrage scolarité : une filière nouvellement configurée reçoit ses trois règles, et un
 * changement de moyenne de passage / éliminatoire y est répercuté sur les règles qui avaient encore
 * l'ancienne valeur (une règle réglée à part dans Paramétrage bulletins reste telle quelle). */
const derniersSeuils = new Map(getScolariteConfigs().map((c) => [c.filiereId, { passage: c.moyennePassage, eliminatoire: c.moyenneEliminatoire }]));
function suivreConfigsScolarite() {
  let change = false;
  for (const c of getScolariteConfigs()) {
    if (!store.some((r) => r.filiereId === c.filiereId)) {
      store = [...store, ...reglesPour({ id: c.filiereId, nom: c.filiere })];
      change = true;
    }
    const avant = derniersSeuils.get(c.filiereId);
    if (avant && (avant.passage !== c.moyennePassage || avant.eliminatoire !== c.moyenneEliminatoire)) {
      store = store.map((r) => {
        if (r.filiereId !== c.filiereId) return r;
        const maj = { ...r };
        if (r.moyennePassage === avant.passage) maj.moyennePassage = c.moyennePassage;
        if (r.moyenneEliminatoire === avant.eliminatoire) maj.moyenneEliminatoire = c.moyenneEliminatoire;
        return maj;
      });
      change = true;
    }
    derniersSeuils.set(c.filiereId, { passage: c.moyennePassage, eliminatoire: c.moyenneEliminatoire });
  }
  if (change) persist();
}

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    ecrireStockage(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

suivreConfigsScolarite();
subscribeScolariteConfigs(suivreConfigsScolarite);

export function subscribeReglesValidation(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getReglesValidation(): RegleValidationRecord[] {
  return store;
}

/** Première règle correspondant à la filière et au type — c'est celle réellement appliquée par
 * le calcul des décisions (Délibérations, moyenne annuelle/programme). */
export function getRegleValidation(filiereId: string, type: TypeRegleValidation): RegleValidationRecord | undefined {
  return store.find((r) => r.filiereId === filiereId && r.type === type);
}

export interface RegleValidationPayload {
  filiereId: string;
  type: TypeRegleValidation;
  validationParCredit: boolean;
  validationParMoyenne: boolean;
  creditPassage: number;
  moyennePassage: number;
  moyenneEliminatoire: number;
}

export function upsertRegleValidation(payload: RegleValidationPayload, id: string | undefined, modifiePar: string): RegleValidationRecord {
  const modifieLe = new Date().toISOString().slice(0, 10);
  const filiere = FILIERES.find((f) => f.id === payload.filiereId)?.nom ?? "";
  const existing = id ? store.find((r) => r.id === id) : undefined;
  if (existing) {
    Object.assign(existing, payload, { filiere, modifiePar, modifieLe });
    persist();
    return existing;
  }
  const record: RegleValidationRecord = { id: `regle-val-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, filiere, modifiePar, modifieLe, ...payload };
  store.unshift(record);
  persist();
  return record;
}

export function deleteRegleValidation(id: string): void {
  store = store.filter((r) => r.id !== id);
  persist();
}

/** Décision de jury réelle, combinant les critères activés (crédit et/ou moyenne) de la règle de
 * validation. Un critère désactivé n'est jamais bloquant. La fenêtre de rattrapage ne s'applique
 * qu'au critère de moyenne (le crédit ne se "rattrape" pas de la même façon). */
export function decideValidation(
  moyenne: number,
  creditsObtenus: number,
  absencesHeures: number,
  regle: RegleValidationRecord,
): "admis" | "ajourne" | "rattrapage" | "exclu" {
  // Seuil d'absences et marge de rattrapage : règles de calcul de la filière (Paramétrage scolarité).
  const { heuresAbsenceExclusion, margeRattrapage } = reglesDeCalcul(regle.filiereId);
  if (heuresAbsenceExclusion > 0 && absencesHeures > heuresAbsenceExclusion) return "exclu";
  if (regle.moyenneEliminatoire > 0 && !atteint(moyenne, regle.moyenneEliminatoire)) return "exclu";

  const okMoyenne = !regle.validationParMoyenne || atteint(moyenne, regle.moyennePassage);
  const okCredit = !regle.validationParCredit || creditsObtenus >= regle.creditPassage;

  if (okMoyenne && okCredit) return "admis";
  if (regle.validationParMoyenne && !okMoyenne && okCredit && atteint(moyenne, regle.moyennePassage - margeRattrapage)) return "rattrapage";
  return "ajourne";
}
