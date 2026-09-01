const STORAGE_KEY = "edumanage-communication-roles-v1";

/** Les 3 onglets de la référence (Validateur Messages, Validateur demande rallonge, Destinataires
 * alert) partagent exactement la même structure (un compte + une remarque) — un seul store
 * paramétré par rôle, plutôt que trois écrans dupliqués. */
export type RoleCommunication = "validateur_message" | "validateur_rallonge" | "destinataire_alert";

export interface CommunicationRoleRecord {
  id: string;
  role: RoleCommunication;
  userId: string;
  userLabel: string;
  remarque?: string;
  /** Uniquement pour "destinataire_alert" — le type d'alerte concerné (colonne "Action" de la référence). */
  action?: string;
}

let store: CommunicationRoleRecord[] = load();

function load(): CommunicationRoleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommunicationRoleRecord[];
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

export function subscribeCommunicationRoles(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCommunicationRoles(): CommunicationRoleRecord[] {
  return store;
}

export function getCommunicationRolesParType(role: RoleCommunication): CommunicationRoleRecord[] {
  return store.filter((r) => r.role === role);
}

/** Un compte donné n'est jamais désigné deux fois pour le même rôle. */
export function estAutorise(role: RoleCommunication, userId: string): boolean {
  return store.some((r) => r.role === role && r.userId === userId);
}

export interface CommunicationRolePayload {
  role: RoleCommunication;
  userId: string;
  userLabel: string;
  remarque?: string;
  action?: string;
}

export function ajouterCommunicationRole(payload: CommunicationRolePayload): CommunicationRoleRecord {
  const record: CommunicationRoleRecord = { id: `com-role-${Date.now()}`, ...payload };
  store.unshift(record);
  persist();
  return record;
}

export function supprimerCommunicationRole(id: string): void {
  store = store.filter((r) => r.id !== id);
  persist();
}
