export type PersonnelRole = "superadmin" | "admin" | "directeur" | "secretaire" | "comptable" | "enseignant";

export interface PersonnelRecord {
  id: string;
  username: string;
  nom: string;
  email: string;
  role: PersonnelRole;
  statut: "actif" | "inactif" | "suspendu";
  derniereConnexion: string;
  creeLe: string;
}

export const ROLE_META: Record<PersonnelRole, { label: string; cls: string; desc: string; color: string; bg: string }> = {
  superadmin: { label: "Super Admin", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300", desc: "Accès total au système", color: "#ef4444", bg: "#fef2f2" },
  admin: { label: "Administrateur", cls: "bg-primary/10 text-primary", desc: "Gestion complète sauf paramètres critiques", color: "#4f46e5", bg: "#eef2ff" },
  directeur: { label: "Directeur", cls: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300", desc: "Consultation + validation notes/délibérations", color: "#8b5cf6", bg: "#f5f3ff" },
  secretaire: { label: "Secrétariat", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300", desc: "Gestion étudiants, inscriptions, planning", color: "#3b82f6", bg: "#eff6ff" },
  comptable: { label: "Comptable", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", desc: "Finances, paiements, vacations", color: "#10b981", bg: "#ecfdf5" },
  enseignant: { label: "Enseignant", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300", desc: "Saisie notes, consultation planning", color: "#f59e0b", bg: "#fffbeb" },
};

export const STATUT_META = {
  actif: { label: "Actif", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  inactif: { label: "Inactif", cls: "bg-muted text-muted-foreground" },
  suspendu: { label: "Suspendu", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

const STORAGE_KEY = "edumanage-personnel-v1";

function seed(): PersonnelRecord[] {
  return [
    { id: "u1", username: "o.diallo", nom: "Ousmane DIALLO", email: "admin@edumanage.com", role: "superadmin", statut: "actif", derniereConnexion: "Aujourd'hui 09:42", creeLe: "2023-09-01" },
    { id: "u2", username: "f.ndiaye", nom: "Fatou NDIAYE", email: "directrice@edumanage.com", role: "directeur", statut: "actif", derniereConnexion: "Hier 16:30", creeLe: "2023-09-01" },
    { id: "u3", username: "i.diop", nom: "Ibrahima DIOP", email: "secretariat@edumanage.com", role: "secretaire", statut: "actif", derniereConnexion: "Aujourd'hui 08:15", creeLe: "2024-01-15" },
    { id: "u4", username: "m.toure", nom: "Mariama TOURE", email: "compta@edumanage.com", role: "comptable", statut: "actif", derniereConnexion: "Il y a 2j", creeLe: "2024-01-15" },
    { id: "u5", username: "c.fall", nom: "Pr. Cheikh FALL", email: "prof@edumanage.com", role: "enseignant", statut: "actif", derniereConnexion: "Aujourd'hui 11:05", creeLe: "2024-09-01" },
    { id: "u6", username: "a.diallo", nom: "Dr. Aminata DIALLO", email: "aminata.diallo@edumanage.com", role: "enseignant", statut: "inactif", derniereConnexion: "Il y a 5j", creeLe: "2024-09-01" },
    { id: "u7", username: "s.mbaye", nom: "Seydou MBAYE", email: "s.mbaye@edumanage.com", role: "admin", statut: "suspendu", derniereConnexion: "Il y a 30j", creeLe: "2024-03-10" },
  ];
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): PersonnelRecord[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    return JSON.parse(raw) as PersonnelRecord[];
  } catch {
    return seed();
  }
}

let store: PersonnelRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribePersonnel(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPersonnel(): PersonnelRecord[] {
  return store;
}

export function getPersonnelById(id: string): PersonnelRecord | undefined {
  return store.find((p) => p.id === id);
}

export interface UpsertPersonnelPayload {
  id?: string;
  username: string;
  nom: string;
  email: string;
  role: PersonnelRole;
  statut: "actif" | "inactif" | "suspendu";
}

export function upsertPersonnel(payload: UpsertPersonnelPayload): PersonnelRecord {
  if (payload.id) {
    const idx = store.findIndex((p) => p.id === payload.id);
    if (idx >= 0) {
      store[idx] = { ...store[idx], username: payload.username, nom: payload.nom, email: payload.email, role: payload.role, statut: payload.statut };
      persist();
      return store[idx];
    }
  }
  const record: PersonnelRecord = {
    id: `pers-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    username: payload.username,
    nom: payload.nom,
    email: payload.email,
    role: payload.role,
    statut: payload.statut,
    derniereConnexion: "Jamais",
    creeLe: new Date().toISOString().slice(0, 10),
  };
  store.push(record);
  persist();
  return record;
}

export function supprimerPersonnel(id: string): void {
  store = store.filter((p) => p.id !== id);
  persist();
}
