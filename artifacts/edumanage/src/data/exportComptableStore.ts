const STORAGE_KEY = "edumanage-export-comptable-v1";

export interface ExportComptableRecord {
  id: string;
  reference: string;
  date: string;
  periodeDebut: string;
  periodeFin: string;
  categories: string[];
  totalRecettes: number;
  totalDepenses: number;
  totalAjustements: number;
  soldeNet: number;
  nbLignes: number;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

interface Persisted {
  records: ExportComptableRecord[];
  counter: number;
}

function load(): Persisted {
  if (typeof window === "undefined") return { records: [], counter: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [], counter: 0 };
    return JSON.parse(raw) as Persisted;
  } catch {
    return { records: [], counter: 0 };
  }
}

let store: Persisted = load();

function persist() {
  store = { ...store, records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeExportsComptables(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getExportsComptables(): ExportComptableRecord[] {
  return store.records;
}

export interface NouvelExportComptable {
  periodeDebut: string;
  periodeFin: string;
  categories: string[];
  totalRecettes: number;
  totalDepenses: number;
  totalAjustements: number;
  nbLignes: number;
}

export function enregistrerExportComptable(payload: NouvelExportComptable): ExportComptableRecord {
  const date = new Date().toISOString().slice(0, 10);
  store.counter = (store.counter ?? 0) + 1;
  const reference = `EXP-${new Date(date).getFullYear()}-${String(store.counter).padStart(3, "0")}`;
  const record: ExportComptableRecord = {
    id: `export-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reference,
    date,
    periodeDebut: payload.periodeDebut,
    periodeFin: payload.periodeFin,
    categories: payload.categories,
    totalRecettes: payload.totalRecettes,
    totalDepenses: payload.totalDepenses,
    totalAjustements: payload.totalAjustements,
    soldeNet: payload.totalRecettes - payload.totalDepenses,
    nbLignes: payload.nbLignes,
  };
  store.records = [record, ...store.records];
  persist();
  return record;
}
