import { FILIERES } from "./mockData";

const STORAGE_KEY = "edumanage-scolarite-config-v1";

export interface ScolariteConfigRecord {
  id: string;
  filiereId: string;
  filiere: string;
  noteBareme: number;
  cumulCredit: boolean;
  moyennePassage: number;
  moyenneEliminatoire: number;
  modifiePar?: string;
  modifieLe?: string;
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

const OVERRIDES: Record<string, Partial<ScolariteConfigRecord>> = {
  f1: { moyenneEliminatoire: 8 },
  f4: { cumulCredit: false },
  f5: { moyenneEliminatoire: 8 },
};

function seedConfigs(): ScolariteConfigRecord[] {
  return FILIERES.map((f) => ({
    id: `scol-cfg-${f.id}`,
    filiereId: f.id,
    filiere: f.nom,
    noteBareme: DEFAUT.noteBareme,
    cumulCredit: DEFAUT.cumulCredit,
    moyennePassage: DEFAUT.moyennePassage,
    moyenneEliminatoire: DEFAUT.moyenneEliminatoire,
    ...OVERRIDES[f.id],
  }));
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

function persist() {
  store = { ...store, configs: store.configs.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

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
