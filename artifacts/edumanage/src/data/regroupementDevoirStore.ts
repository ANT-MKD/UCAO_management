import { getTypesEvaluation } from "./typeEvaluationStore";

const STORAGE_KEY = "edumanage-regroupement-devoir-store-v1";

export type RoleRegroupement = "devoir" | "examen";

export interface RegroupementDevoirRecord {
  id: string;
  code: string;
  intitule: string;
  /** Côté du calcul d'EC (CC ou EF) auquel ce regroupement contribue. */
  role: RoleRegroupement;
  typeEvaluationIds: string[];
}

function seed(): RegroupementDevoirRecord[] {
  const types = getTypesEvaluation();
  const idFor = (code: string) => types.find((t) => t.code === code)?.id;
  const ccTypes = [idFor("CONTROLE_CONTINU"), idFor("DEVOIR"), idFor("PARTIEL")].filter((x): x is string => !!x);
  const efTypes = [idFor("COMPOSITION"), idFor("EXAMEN")].filter((x): x is string => !!x);
  return [
    { id: "regroupement-devoir-cc", code: "1", intitule: "Devoir", role: "devoir", typeEvaluationIds: ccTypes },
    { id: "regroupement-devoir-ef", code: "2", intitule: "Examen", role: "examen", typeEvaluationIds: efTypes },
  ];
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): RegroupementDevoirRecord[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as RegroupementDevoirRecord[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seed();
  } catch {
    return seed();
  }
}

let store: RegroupementDevoirRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeRegroupementsDevoir(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRegroupementsDevoir(): RegroupementDevoirRecord[] {
  return store;
}

export function getRegroupementDevoirById(id: string): RegroupementDevoirRecord | undefined {
  return store.find((r) => r.id === id);
}

export interface RegroupementDevoirPayload {
  code: string;
  intitule: string;
  role: RoleRegroupement;
  typeEvaluationIds: string[];
}

export function upsertRegroupementDevoir(payload: RegroupementDevoirPayload, id?: string): RegroupementDevoirRecord {
  const existing = id ? store.find((r) => r.id === id) : undefined;
  if (existing) {
    Object.assign(existing, payload);
    persist();
    return existing;
  }
  const record: RegroupementDevoirRecord = { id: `regroupement-devoir-${Date.now()}`, ...payload };
  store.unshift(record);
  persist();
  return record;
}

export function deleteRegroupementDevoir(id: string): void {
  store = store.filter((r) => r.id !== id);
  persist();
}

/** Résout le rôle (devoir/examen) d'un type d'évaluation via le premier regroupement qui le
 * contient. Retourne undefined si aucun regroupement ne le référence — l'appelant retombe alors
 * sur le type plat "devoir"/"examen" de l'évaluation elle-même. */
export function getRoleForTypeEvaluation(typeEvaluationId: string): RoleRegroupement | undefined {
  return store.find((r) => r.typeEvaluationIds.includes(typeEvaluationId))?.role;
}
