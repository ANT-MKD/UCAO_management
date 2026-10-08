import { ecrireStockage } from "@/lib/stockageLocal";
import { getEtudiants, getUserAccounts, logAudit, pushNotificationEtPersister } from "./studentStore";

export const TAILLE_MAX_RESSOURCE_OCTETS = 800 * 1024;

export interface RessourcePedagogiqueRecord {
  id: string;
  classeId: string;
  classe: string;
  ecId?: string;
  ec?: string;
  titre: string;
  description?: string;
  /** Ressource fichier téléversé — absents pour une ressource de type lien externe (voir `url`). */
  nom?: string;
  dataUrl?: string;
  tailleOctets?: number;
  /** Ressource lien externe (ex. documentation en ligne, vidéo hébergée ailleurs) — mutuellement
   * exclusif avec nom/dataUrl/tailleOctets. */
  url?: string;
  ajouteLe: string;
  ajoutePar: string;
  /** Compte de l'auteur : seul lui (ou l'administration) peut retirer la ressource. */
  ajouteParId?: string;
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
    ecrireStockage(STORAGE_KEY, JSON.stringify(store));
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
    ajouteParId: actorId,
  };
  store.unshift(record);
  logAudit(actorId, "add_ressource_pedagogique", "classe", payload.classeId, payload.titre);
  persist();
  // Les étudiants de la classe sont prévenus du nouveau support.
  const etudiants = new Set(getEtudiants().filter((e) => e.classeId === payload.classeId && e.statut !== "abandon").map((e) => e.id));
  for (const compte of getUserAccounts().filter((u) => u.role === "student" && u.linkedId && etudiants.has(u.linkedId))) {
    pushNotificationEtPersister(compte.id, `Nouvelle ressource pédagogique${payload.ec ? ` en ${payload.ec}` : ""} : « ${payload.titre} ».`);
  }
  return record;
}

/** Un professeur ne retire que les ressources qu'il a déposées ; l'administration, toutes. */
export function peutSupprimerRessource(ressource: Pick<RessourcePedagogiqueRecord, "ajouteParId" | "ajoutePar">, actorId: string): boolean {
  const acteur = getUserAccounts().find((u) => u.id === actorId);
  if (!acteur) return false;
  if (acteur.role === "admin") return true;
  return ressource.ajouteParId ? ressource.ajouteParId === actorId : ressource.ajoutePar === acteur.displayName;
}

export function deleteRessourcePedagogique(id: string, actorId: string): void {
  const ressource = store.find((r) => r.id === id);
  if (!ressource) return;
  if (!peutSupprimerRessource(ressource, actorId)) {
    throw new Error("Vous ne pouvez supprimer que les ressources que vous avez déposées.");
  }
  store = store.filter((r) => r.id !== id);
  logAudit(actorId, "delete_ressource_pedagogique", "classe", ressource.classeId, ressource.titre);
  persist();
}
