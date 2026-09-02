import { logAudit } from "./studentStore";

export type DocumentEntiteType = "etudiant" | "enseignant";

export const TAILLE_MAX_DOCUMENT_OCTETS = 800 * 1024;

export interface DocumentRecord {
  id: string;
  entiteType: DocumentEntiteType;
  entiteId: string;
  nom: string;
  dataUrl: string;
  tailleOctets: number;
  ajouteLe: string;
  ajoutePar: string;
}

const STORAGE_KEY = "edumanage-document-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): DocumentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DocumentRecord[];
  } catch {
    return [];
  }
}

let store: DocumentRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeDocuments(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDocuments(): DocumentRecord[] {
  return store;
}

export function getDocumentsPourEntite(entiteType: DocumentEntiteType, entiteId: string): DocumentRecord[] {
  return store.filter((d) => d.entiteType === entiteType && d.entiteId === entiteId).sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe));
}

export type DocumentInput = Omit<DocumentRecord, "id" | "ajouteLe">;

export function addDocument(payload: DocumentInput, actorId: string): DocumentRecord {
  const record: DocumentRecord = { id: `doc-${Date.now()}`, ajouteLe: new Date().toISOString(), ...payload };
  store.unshift(record);
  logAudit(actorId, "add_document", payload.entiteType, payload.entiteId, payload.nom);
  persist();
  return record;
}

export function deleteDocument(id: string, actorId: string): void {
  const doc = store.find((d) => d.id === id);
  store = store.filter((d) => d.id !== id);
  if (doc) logAudit(actorId, "delete_document", doc.entiteType, doc.entiteId, doc.nom);
  persist();
}
