import { logAudit } from "./studentStore";

export const TAILLE_MAX_RESSOURCE_OCTETS = 800 * 1024;

export interface RessourcePedagogiqueRecord {
  id: string;
  classeId: string;
  classe: string;
  ecId?: string;
  ec?: string;
  titre: string;
  description?: string;
  nom: string;
  dataUrl: string;
  tailleOctets: number;
  ajouteLe: string;
  ajoutePar: string;
}

const STORAGE_KEY = "edumanage-ressource-pedagogique-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): RessourcePedagogiqueRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RessourcePedagogiqueRecord[];
  } catch {
    return [];
  }
}

let store: RessourcePedagogiqueRecord[] = load();
/** Mémoïse getRessourcesPourClasse() par classeId — sans ça, chaque appel renverrait une nouvelle
 * référence de tableau et useSyncExternalStore boucle indéfiniment (getSnapshot doit être stable
 * tant que le store n'a pas changé). Voir studentStore.ts::paiementsByEtudiantCache pour le même
 * motif. */
let parClasseCache = new Map<string, RessourcePedagogiqueRecord[]>();

function persist() {
  store = store.slice();
  parClasseCache = new Map();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeRessourcesPedagogiques(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRessourcesPedagogiques(): RessourcePedagogiqueRecord[] {
  return store;
}

export function getRessourcesPourClasse(classeId: string): RessourcePedagogiqueRecord[] {
  if (!parClasseCache.has(classeId)) {
    const sorted = store.filter((r) => r.classeId === classeId).sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe));
    parClasseCache.set(classeId, sorted);
  }
  return parClasseCache.get(classeId)!;
}

export type RessourcePedagogiqueInput = Omit<RessourcePedagogiqueRecord, "id" | "ajouteLe">;

export function addRessourcePedagogique(payload: RessourcePedagogiqueInput, actorId: string): RessourcePedagogiqueRecord {
  const record: RessourcePedagogiqueRecord = {
    id: `rp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ajouteLe: new Date().toISOString(),
    ...payload,
  };
  store.unshift(record);
  logAudit(actorId, "add_ressource_pedagogique", "classe", payload.classeId, payload.titre);
  persist();
  return record;
}

export function deleteRessourcePedagogique(id: string, actorId: string): void {
  const ressource = store.find((r) => r.id === id);
  store = store.filter((r) => r.id !== id);
  if (ressource) logAudit(actorId, "delete_ressource_pedagogique", "classe", ressource.classeId, ressource.titre);
  persist();
}
