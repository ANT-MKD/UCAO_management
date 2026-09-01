import type { UserRole } from "./studentStore";

const STORAGE_KEY = "edumanage-publicites-v1";

/** Le type détermine comment le contenu est réellement affiché dans la bannière (pas qu'un label) :
 * "image" est encodée en base64 et montrée telle quelle ; les trois autres pointent vers une
 * ressource hébergée ailleurs (aucun stockage vidéo/document réel possible sans backend) et sont
 * rendues comme un lien cliquable. */
export type TypeContenuPublicite = "image" | "video" | "document" | "url";
export type ProfilCiblePublicite = "tous" | UserRole;

export const TYPE_CONTENU_LABELS: Record<TypeContenuPublicite, string> = {
  image: "Image",
  video: "Vidéo",
  document: "Document",
  url: "URL",
};

export const TYPE_CONTENU_LIEN_LABEL: Record<Exclude<TypeContenuPublicite, "image">, string> = {
  video: "Voir la vidéo",
  document: "Voir le document",
  url: "Voir plus",
};

/** Taille max de l'image encodée en base64 (données brutes, avant l'encodage ~33% plus volumineux) —
 * garde le localStorage raisonnable, une bannière n'a pas besoin d'une image lourde. */
export const TAILLE_MAX_IMAGE_OCTETS = 400 * 1024;

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
  /** Uniquement pour typeContenu === "image" — image réelle encodée en base64, affichée telle
   * quelle dans la bannière (plafonnée à TAILLE_MAX_IMAGE_OCTETS). */
  imageDataUrl?: string;
  /** Pour "video" / "document" / "url" — lien externe réel, ouvert dans un nouvel onglet depuis
   * la bannière. */
  lienExterne?: string;
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
  imageDataUrl?: string;
  lienExterne?: string;
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
