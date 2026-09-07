const STORAGE_KEY = "edumanage-export-comptable-v1";

export interface ExportComptableCategorieDetail {
  categorie: string;
  label: string;
  nbLignes: number;
  montant: number;
}

export interface ExportComptableRecord {
  id: string;
  reference: string;
  date: string;
  genereePar: string;
  periodeDebut: string;
  periodeFin: string;
  categories: string[];
  parCategorie: ExportComptableCategorieDetail[];
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

export function getExportComptableById(id: string): ExportComptableRecord | undefined {
  return store.records.find((r) => r.id === id);
}

export interface NouvelExportComptable {
  periodeDebut: string;
  periodeFin: string;
  categories: string[];
  parCategorie: ExportComptableCategorieDetail[];
  genereePar: string;
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
    genereePar: payload.genereePar,
    periodeDebut: payload.periodeDebut,
    periodeFin: payload.periodeFin,
    categories: payload.categories,
    parCategorie: payload.parCategorie,
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

export function trouverExportIdentique(
  periodeDebut: string,
  periodeFin: string,
  categories: string[],
): ExportComptableRecord | undefined {
  const set = [...categories].sort().join(",");
  return store.records.find(
    (r) =>
      r.periodeDebut === periodeDebut &&
      r.periodeFin === periodeFin &&
      [...r.categories].sort().join(",") === set,
  );
}
