import { ecrireStockage } from "@/lib/stockageLocal";
import { logAudit } from "./studentStore";

const STORAGE_KEY = "edumanage-etablissement-v1";

export interface EtablissementInfo {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  siteWeb: string;
  agrement: string;
  logoDataUrl?: string;
}

/** Nom livré avec l'application : tant qu'il n'est pas remplacé, les documents officiels portent
 * un établissement qui n'existe pas (un avertissement le rappelle dans l'administration). */
export const NOM_ETABLISSEMENT_PAR_DEFAUT = "Institut Supérieur EduManage";

const DEFAULT_INFO: EtablissementInfo = {
  nom: NOM_ETABLISSEMENT_PAR_DEFAUT,
  adresse: "Dakar, Sénégal",
  telephone: "",
  email: "",
  siteWeb: "",
  agrement: "",
  logoDataUrl: undefined,
};

function load(): EtablissementInfo {
  if (typeof window === "undefined") return { ...DEFAULT_INFO };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_INFO };
    const parsed = JSON.parse(raw) as Partial<EtablissementInfo>;
    return { ...DEFAULT_INFO, ...parsed };
  } catch {
    return { ...DEFAULT_INFO };
  }
}

let store: EtablissementInfo = load();

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function persist() {
  store = { ...store };
  if (typeof window !== "undefined") {
    ecrireStockage(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeEtablissement(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Consultée directement par les générateurs de documents imprimables (printDocument.ts,
 * contractPrint.ts, RelevesPage.tsx) — un seul point de vérité pour l'identité de l'établissement
 * sur tous les documents officiels, jamais un nom codé en dur par template. */
export function getEtablissement(): EtablissementInfo {
  return store;
}

export function updateEtablissement(payload: EtablissementInfo, actorId: string): void {
  store = { ...payload };
  logAudit(actorId, "update_etablissement", "etablissement", "etablissement", payload.nom);
  persist();
}

/** Vrai tant que le nom de l'établissement n'a jamais été renseigné. */
export function nomEtablissementParDefaut(info: EtablissementInfo = store): boolean {
  return !info.nom.trim() || info.nom.trim() === NOM_ETABLISSEMENT_PAR_DEFAUT;
}

/** Ville pour « Fait à … » : début de l'adresse (« Dakar, Sénégal » → « Dakar »). */
export function villeEtablissement(info: EtablissementInfo = store): string {
  return info.adresse.split(/[,\n]/)[0].trim();
}

/** Identité saisie à l'installation : le reste (téléphone, logo…) se complète dans les Paramètres. */
export function definirIdentiteEtablissement(nom: string, adresse: string, actorId: string): void {
  const nomPropre = nom.trim();
  if (!nomPropre) throw new Error("Indiquez le nom de l'établissement : il figure sur les reçus, attestations et procès-verbaux.");
  updateEtablissement({ ...store, nom: nomPropre, adresse: adresse.trim() || store.adresse }, actorId);
}
