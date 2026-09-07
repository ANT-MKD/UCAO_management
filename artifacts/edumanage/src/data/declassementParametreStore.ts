const STORAGE_KEY = "edumanage-declassement-parametre-store-v1";

export interface DeclassementParametreRecord {
  id: string;
  filiereId: string;
  filiere: string;
  annee: string;
  niveau: string;
  niveauLabel: string;
  typeEvaluationId: string;
  typeEvaluationLabel: string;
  nbNotesRequis: number;
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): DeclassementParametreRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeclassementParametreRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let store: DeclassementParametreRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeDeclassementParametres(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDeclassementParametres(): DeclassementParametreRecord[] {
  return store;
}

export function getDeclassementParametresPour(filiereId: string, niveau: string, annee: string): DeclassementParametreRecord[] {
  return store.filter((p) => p.filiereId === filiereId && p.niveau === niveau && p.annee === annee);
}

export interface DeclassementParametrePayload {
  filiereId: string;
  filiere: string;
  annee: string;
  niveau: string;
  niveauLabel: string;
  typeEvaluationId: string;
  typeEvaluationLabel: string;
  nbNotesRequis: number;
}

export function upsertDeclassementParametre(payload: DeclassementParametrePayload, id?: string): DeclassementParametreRecord {
  const existing = id ? store.find((p) => p.id === id) : undefined;
  if (existing) {
    Object.assign(existing, payload);
    persist();
    return existing;
  }
  const record: DeclassementParametreRecord = { id: `declass-param-${Date.now()}`, ...payload };
  store.unshift(record);
  persist();
  return record;
}

export function deleteDeclassementParametre(id: string): void {
  store = store.filter((p) => p.id !== id);
  persist();
}
