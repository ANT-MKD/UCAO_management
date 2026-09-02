import { logAudit } from "./studentStore";

export type MemoEntiteType = "etudiant" | "enseignant";
export type MemoType = "Administratif" | "Pédagogique" | "Discipline" | "Autre";

export interface MemoRecord {
  id: string;
  entiteType: MemoEntiteType;
  entiteId: string;
  type: MemoType;
  date: string;
  objet: string;
  contenu: string;
  auteur: string;
}

const STORAGE_KEY = "edumanage-memo-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): MemoRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MemoRecord[];
  } catch {
    return [];
  }
}

let store: MemoRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeMemos(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getMemos(): MemoRecord[] {
  return store;
}

export function getMemosPourEntite(entiteType: MemoEntiteType, entiteId: string): MemoRecord[] {
  return store.filter((m) => m.entiteType === entiteType && m.entiteId === entiteId).sort((a, b) => b.date.localeCompare(a.date));
}

export type MemoInput = Omit<MemoRecord, "id">;

export function addMemo(payload: MemoInput, actorId: string): MemoRecord {
  const record: MemoRecord = { id: `memo-${Date.now()}`, ...payload };
  store.unshift(record);
  logAudit(actorId, "create_memo", payload.entiteType, payload.entiteId, payload.objet);
  persist();
  return record;
}

export function deleteMemo(id: string, actorId: string): void {
  const memo = store.find((m) => m.id === id);
  store = store.filter((m) => m.id !== id);
  if (memo) logAudit(actorId, "delete_memo", memo.entiteType, memo.entiteId, memo.objet);
  persist();
}
