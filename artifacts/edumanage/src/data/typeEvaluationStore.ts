const STORAGE_KEY = "edumanage-type-evaluation-store-v1";

export interface TypeEvaluationRecord {
  id: string;
  code: string;
  intitule: string;
  actif: boolean;
}

const SEED: { code: string; intitule: string }[] = [
  { code: "COMPOSITION", intitule: "Composition" },
  { code: "CONTROLE_CONTINU", intitule: "Contrôle continu" },
  { code: "DEVOIR", intitule: "Devoir" },
  { code: "EXAMEN", intitule: "Examen" },
  { code: "PARTIEL", intitule: "Partiel" },
];

function seed(): TypeEvaluationRecord[] {
  return SEED.map((s) => ({ id: `type-eval-${s.code}`, code: s.code, intitule: s.intitule, actif: true }));
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): TypeEvaluationRecord[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as TypeEvaluationRecord[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seed();
  } catch {
    return seed();
  }
}

let store: TypeEvaluationRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeTypesEvaluation(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTypesEvaluation(): TypeEvaluationRecord[] {
  return store;
}

export function getTypeEvaluationById(id: string): TypeEvaluationRecord | undefined {
  return store.find((t) => t.id === id);
}

export interface TypeEvaluationPayload {
  code: string;
  intitule: string;
  actif: boolean;
}

export function upsertTypeEvaluation(payload: TypeEvaluationPayload, id?: string): TypeEvaluationRecord {
  const existing = id ? store.find((t) => t.id === id) : undefined;
  if (existing) {
    Object.assign(existing, payload);
    persist();
    return existing;
  }
  const record: TypeEvaluationRecord = { id: `type-eval-${Date.now()}`, ...payload };
  store.unshift(record);
  persist();
  return record;
}

export function deleteTypeEvaluation(id: string): void {
  store = store.filter((t) => t.id !== id);
  persist();
}
