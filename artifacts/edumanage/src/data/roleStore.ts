import { collectAllLeaves, getLeafIdsForSection } from "@/lib/adminNavConfig";
import { getUserAccounts, logAudit } from "./studentStore";

const STORAGE_KEY = "edumanage-roles-v1";

export interface RoleRecord {
  id: string;
  code: string;
  description: string;
  /** Ids des pages de adminNavConfig.ts (ADMIN_NAV_SECTIONS) auxquelles ce rôle donne accès —
   * jamais une liste de permissions inventée séparément du vrai menu. */
  accessibleItemIds: string[];
  auteurId: string;
  createdAt: string;
}

function seed(): RoleRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: "role-secretariat",
      code: "ROLE_SECRETARIAT",
      description: "Gestion des étudiants, de la scolarité et de la communication",
      accessibleItemIds: [
        ...getLeafIdsForSection("etudiants"),
        ...getLeafIdsForSection("scolarite"),
        ...getLeafIdsForSection("communication"),
      ],
      auteurId: "u-admin-1",
      createdAt: now,
    },
    {
      id: "role-comptable",
      code: "ROLE_COMPTABLE",
      description: "Finances, paiements et vacations enseignants",
      accessibleItemIds: getLeafIdsForSection("finances"),
      auteurId: "u-admin-1",
      createdAt: now,
    },
    {
      id: "role-direction",
      code: "ROLE_DIRECTION",
      description: "Accès complet à tous les modules — identité distincte de ROLE_ADMIN",
      accessibleItemIds: collectAllLeaves().map((l) => l.id),
      auteurId: "u-admin-1",
      createdAt: now,
    },
  ];
}

function load(): RoleRecord[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as RoleRecord[];
    return Array.isArray(parsed) ? parsed : seed();
  } catch {
    return seed();
  }
}

let store: RoleRecord[] = load();

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

export function subscribeRoles(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRoles(): RoleRecord[] {
  return store;
}

export function getRoleById(id: string): RoleRecord | undefined {
  return store.find((r) => r.id === id);
}

export interface RolePayload {
  code: string;
  description: string;
}

export function upsertRole(payload: RolePayload, auteurId: string, id?: string): RoleRecord {
  const codeLower = payload.code.trim().toLowerCase();
  const existing = id ? store.find((r) => r.id === id) : undefined;
  const conflit = store.some((r) => r.code.toLowerCase() === codeLower && r.id !== id);
  if (conflit) {
    throw new Error("Ce code de rôle est déjà utilisé.");
  }
  if (existing) {
    existing.code = payload.code.trim();
    existing.description = payload.description.trim();
    persist();
    return existing;
  }
  const role: RoleRecord = {
    id: `role-${Date.now()}`,
    code: payload.code.trim(),
    description: payload.description.trim(),
    accessibleItemIds: [],
    auteurId,
    createdAt: new Date().toISOString(),
  };
  store = [role, ...store];
  logAudit(auteurId, "create_role", "role", role.id, role.code);
  persist();
  return role;
}

/** Jamais de suppression d'un rôle encore assigné à un compte — casserait silencieusement l'accès
 * de ces comptes à la prochaine connexion. */
export function deleteRole(id: string): void {
  const enUsage = getUserAccounts().some((u) => u.roleId === id);
  if (enUsage) {
    throw new Error("Ce rôle est assigné à au moins un compte — retirez l'assignation avant de le supprimer.");
  }
  store = store.filter((r) => r.id !== id);
  persist();
}

export function setRoleAccess(id: string, accessibleItemIds: string[], actorUserId: string): void {
  const role = store.find((r) => r.id === id);
  if (!role) return;
  role.accessibleItemIds = accessibleItemIds;
  logAudit(actorUserId, "update_role_access", "role", id, `${accessibleItemIds.length} item(s)`);
  persist();
}
