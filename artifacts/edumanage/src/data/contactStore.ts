import { logAudit } from "./studentStore";

export type ContactRole = "pere" | "mere" | "tuteur" | "autre";

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  pere: "Père",
  mere: "Mère",
  tuteur: "Tuteur",
  autre: "Autre contact",
};

export interface ContactRecord {
  id: string;
  etudiantId: string;
  role: ContactRole;
  nomComplet: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  /** Lien de parenté — utile uniquement pour role "autre" (ex: "Grand frère", "Voisin"). */
  lien?: string;
}

const STORAGE_KEY = "edumanage-contact-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): ContactRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ContactRecord[];
  } catch {
    return [];
  }
}

let store: ContactRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeContacts(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getContacts(): ContactRecord[] {
  return store;
}

export function getContactsPourEtudiant(etudiantId: string): ContactRecord[] {
  return store.filter((c) => c.etudiantId === etudiantId);
}

export type ContactInput = Omit<ContactRecord, "id">;

export function addContact(payload: ContactInput, actorId: string): ContactRecord {
  const record: ContactRecord = { id: `ct-${Date.now()}`, ...payload };
  store.push(record);
  logAudit(actorId, "add_contact", "etudiant", payload.etudiantId, `${CONTACT_ROLE_LABELS[payload.role]} — ${payload.nomComplet}`);
  persist();
  return record;
}

export function updateContact(id: string, patch: Partial<ContactInput>, actorId: string): void {
  const contact = store.find((c) => c.id === id);
  if (!contact) return;
  store = store.map((c) => (c.id === id ? { ...c, ...patch } : c));
  logAudit(actorId, "update_contact", "etudiant", contact.etudiantId, contact.nomComplet);
  persist();
}

export function deleteContact(id: string, actorId: string): void {
  const contact = store.find((c) => c.id === id);
  store = store.filter((c) => c.id !== id);
  if (contact) logAudit(actorId, "delete_contact", "etudiant", contact.etudiantId, contact.nomComplet);
  persist();
}
