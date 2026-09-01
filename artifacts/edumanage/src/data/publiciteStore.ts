import type { UserRole } from "./studentStore";

const STORAGE_KEY = "edumanage-publicites-v1";

export type TypeContenuPublicite = "publicite" | "actualite" | "annonce";
export type ProfilCiblePublicite = "tous" | UserRole;

export const TYPE_CONTENU_LABELS: Record<TypeContenuPublicite, string> = {
  publicite: "Publicité",
  actualite: "Actualité",
  annonce: "Annonce",
};

export const PROFIL_CIBLE_LABELS: Record<ProfilCiblePublicite, string> = {
  tous: "Tous les profils",
  student: "Étudiants",
  teacher: "Professeurs",
  admin: "Administration",
};

export interface PubliciteRecord {
  id: string;
  typeContenu: TypeContenuPublicite;
  profilCible: ProfilCiblePublicite;
  titre: string;
  description: string;
  ordre: number;
  dateDebut: string;
  dateFin: string;
  /** Référence locale (nom fichier) — pas de stockage binaire lourd. */
  fichier?: string;
  auteurId: string;
  auteurLabel: string;
  createdAt: string;
}

let store: PubliciteRecord[] = load();

function load(): PubliciteRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PubliciteRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribePublicites(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPublicites(): PubliciteRecord[] {
  return store;
}

export interface PublicitePayload {
  typeContenu: TypeContenuPublicite;
  profilCible: ProfilCiblePublicite;
  titre: string;
  description: string;
  ordre: number;
  dateDebut: string;
  dateFin: string;
  fichier?: string;
  auteurId: string;
  auteurLabel: string;
}

export function upsertPublicite(payload: PublicitePayload, id?: string): PubliciteRecord {
  const existing = id ? store.find((p) => p.id === id) : undefined;
  if (existing) {
    Object.assign(existing, payload);
    persist();
    return existing;
  }
  const record: PubliciteRecord = { id: `pub-${Date.now()}`, createdAt: new Date().toISOString(), ...payload };
  store = [record, ...store];
  persist();
  return record;
}

export function deletePublicite(id: string): void {
  store = store.filter((p) => p.id !== id);
  persist();
}

/** Sélectionne les publicités réellement actives aujourd'hui pour un profil donné, triées par ordre
 * d'affichage — c'est cette fonction qui alimente les bannières des tableaux de bord, jamais une
 * copie figée au moment de la création. */
export function getPublicitesActives(profil: UserRole): PubliciteRecord[] {
  const today = new Date().toISOString().slice(0, 10);
  return store
    .filter((p) => (p.profilCible === "tous" || p.profilCible === profil) && p.dateDebut <= today && today <= p.dateFin)
    .sort((a, b) => a.ordre - b.ordre);
}
