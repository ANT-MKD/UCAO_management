import { ecrireStockage } from "@/lib/stockageLocal";
const STORAGE_KEY = "edumanage-organismes-pec-v1";

export interface OrganismePECRecord {
  id: string;
  intitule: string;
  adresse: string;
  telephone?: string;
  email?: string;
  remarques?: string;
  contactNom: string;
  contactTelephone?: string;
  contactEmail?: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Une installation neuve démarre sans organisme : chacun est saisi avec ses vraies coordonnées
 * (Finances › Organismes de prise en charge). */
function load(): OrganismePECRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OrganismePECRecord[];
  } catch {
    return [];
  }
}

let store: OrganismePECRecord[] = load();

function persist() {
  // Nouvelle référence de tableau : useSyncExternalStore compare par Object.is
  // et ne re-rend pas si getOrganismesPEC() renvoie la même référence.
  store = store.slice();
  if (typeof window !== "undefined") {
    ecrireStockage(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeOrganismesPEC(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getOrganismesPEC(): OrganismePECRecord[] {
  return store;
}

/** Fiches de la base (avec Supabase), numérotées par elle. */
export function remplacerOrganismesPEC(records: OrganismePECRecord[]) {
  store = records;
  persist();
}

export function getOrganismePECById(id: string): OrganismePECRecord | undefined {
  return store.find((o) => o.id === id);
}

export type OrganismePECPayload = Omit<OrganismePECRecord, "id">;

export function addOrganismePEC(payload: OrganismePECPayload): OrganismePECRecord {
  const record: OrganismePECRecord = {
    ...payload,
    id: `org-pec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };
  store.push(record);
  persist();
  return record;
}

export function updateOrganismePEC(id: string, payload: OrganismePECPayload): void {
  store = store.map((o) => (o.id === id ? { ...o, ...payload } : o));
  persist();
}

export function deleteOrganismePEC(id: string): void {
  store = store.filter((o) => o.id !== id);
  persist();
}
