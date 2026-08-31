import { FILIERES } from "./mockData";
import { getScolariteConfigs } from "./scolariteConfigStore";

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

function seed(): RegleValidationRecord[] {
  const configs = getScolariteConfigs();
  const types: TypeRegleValidation[] = ["semestre", "annee", "programme"];
  return FILIERES.flatMap((f) => {
    const config = configs.find((c) => c.filiereId === f.id);
    // Le type "semestre" reprend exactement le comportement historique des Délibérations
    // (validation par moyenne uniquement) pour ne rien changer tant que rien n'est reconfiguré.
    return types.map((type): RegleValidationRecord => ({
      id: `regle-val-${f.id}-${type}`,
      filiereId: f.id,
      filiere: f.nom,
      type,
      validationParCredit: type === "semestre" ? false : (config?.cumulCredit ?? true),
      validationParMoyenne: true,
      creditPassage: 0,
      moyennePassage: config?.moyennePassage ?? 10,
      moyenneEliminatoire: config?.moyenneEliminatoire ?? 0,
    }));
  });
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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seed();
  } catch {
    return seed();
  }
}

let store: RegleValidationRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

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
  const record: RegleValidationRecord = { id: `regle-val-${Date.now()}`, filiere, modifiePar, modifieLe, ...payload };
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
  if (absencesHeures > 10) return "exclu";
  if (regle.moyenneEliminatoire > 0 && moyenne < regle.moyenneEliminatoire) return "exclu";

  const okMoyenne = !regle.validationParMoyenne || moyenne >= regle.moyennePassage;
  const okCredit = !regle.validationParCredit || creditsObtenus >= regle.creditPassage;

  if (okMoyenne && okCredit) return "admis";
  if (regle.validationParMoyenne && !okMoyenne && okCredit && moyenne >= regle.moyennePassage - 2) return "rattrapage";
  return "ajourne";
}
