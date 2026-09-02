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

const DEFAULT_INFO: EtablissementInfo = {
  nom: "Institut Supérieur EduManage",
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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
