import type { UserRole } from "./studentStore";

const STORAGE_KEY = "edumanage-portal-access-v1";

export type PortalAccessState = Record<UserRole, boolean>;

export const PORTAL_LABELS: Record<UserRole, string> = {
  admin: "Administration",
  teacher: "Professeurs",
  student: "Étudiants",
};

const DEFAULT_STATE: PortalAccessState = { admin: true, teacher: true, student: true };

function load(): PortalAccessState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<PortalAccessState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

let store: PortalAccessState = load();

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function persist() {
  store = { ...store };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribePortalAccess(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPortalAccess(): PortalAccessState {
  return store;
}

/** Consultée réellement par AuthContext.login() — un portail désactivé bloque la connexion pour
 * tous les comptes de ce rôle, immédiatement (pas seulement un affichage côté Sécurité). */
export function isPortalActif(role: UserRole): boolean {
  return store[role];
}

/** Le portail admin ne peut jamais être désactivé — sinon plus personne ne pourrait se
 * reconnecter pour le réactiver (auto-verrouillage). */
export function setPortalActif(role: UserRole, actif: boolean): void {
  if (role === "admin" && !actif) {
    throw new Error("Le portail Administration ne peut pas être désactivé (risque de verrouillage total).");
  }
  store = { ...store, [role]: actif };
  persist();
}
