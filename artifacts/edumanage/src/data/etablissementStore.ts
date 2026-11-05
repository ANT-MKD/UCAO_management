import { ecrireStockage, lireStockage } from "@/lib/stockageLocal";
import { logAudit } from "./studentStore";

const STORAGE_KEY = "edumanage-etablissement-v1";

/** Présentation de l'en-tête des documents scolaires (Paramètres généraux → Documents officiels) :
 * « standard » (celle livrée avec l'application), « banniere » (une image qui contient tout
 * l'en-tête) ou « compose » (logo de l'établissement, logo de droite, lignes de texte). */
export type FormeEntete = "standard" | "banniere" | "compose";

/** Une ligne de l'en-tête composé ; la base en contrôle le contenu (au plus 6, 120 caractères). */
export interface LigneEntete {
  texte: string;
  taille: "grande" | "moyenne" | "petite";
  style: "gras" | "normal" | "italique";
  couleur: "noir" | "bleu" | "bordeaux";
}

export interface EtablissementInfo {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  siteWeb: string;
  agrement: string;
  logoDataUrl?: string;
  /** Ville de « Fait à …, le … » ; vide : le début de l'adresse. */
  ville: string;
  enteteForme: FormeEntete;
  /** Image de l'en-tête entier (forme « banniere »). */
  banniereDataUrl?: string;
  /** Logo de droite de l'en-tête composé (celui de gauche est le logo de l'établissement). */
  logoDroitDataUrl?: string;
  enteteLignes: LigneEntete[];
  /** Cadre autour de l'en-tête composé. */
  enteteCadre: boolean;
  /** Lignes du bas de page des documents scolaires (au plus 3). */
  piedLignes: string[];
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
  ville: "",
  enteteForme: "standard",
  banniereDataUrl: undefined,
  logoDroitDataUrl: undefined,
  enteteLignes: [],
  enteteCadre: true,
  piedLignes: [],
};

function load(): EtablissementInfo {
  if (typeof window === "undefined") return { ...DEFAULT_INFO };
  try {
    const raw = lireStockage(STORAGE_KEY);
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

/** Identité telle que la base la range (une seule ligne, créée à l'installation). Le logo reste
 * dans le navigateur jusqu'au stockage des fichiers (partie 4). */
export function getEtablissementLignes(): (EtablissementInfo & { id: string })[] {
  return [{ id: "1", ...store }];
}

/** Identité de la base (avec Supabase) ; pas encore installé : celle du navigateur reste. */
export function remplacerEtablissement(lignes: (EtablissementInfo & { id: string })[]) {
  const ligne = lignes[0];
  if (!ligne) return;
  const { id: _id, ...info } = ligne;
  // Un champ absent de la ligne garde sa valeur par défaut (jamais « undefined » à la place d'une liste).
  const presents = Object.fromEntries(Object.entries(info).filter(([, v]) => v !== undefined));
  store = { ...DEFAULT_INFO, ...presents };
  persist();
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

/** Ville pour « Fait à … » : celle des Documents officiels, sinon le début de l'adresse
 * (« Dakar, Sénégal » → « Dakar »). */
export function villeEtablissement(info: EtablissementInfo = store): string {
  return info.ville?.trim() || info.adresse.split(/[,\n]/)[0].trim();
}

/** Identité saisie à l'installation : le reste (téléphone, logo…) se complète dans les Paramètres. */
export function definirIdentiteEtablissement(nom: string, adresse: string, actorId: string): void {
  const nomPropre = nom.trim();
  if (!nomPropre) throw new Error("Indiquez le nom de l'établissement : il figure sur les reçus, attestations et procès-verbaux.");
  updateEtablissement({ ...store, nom: nomPropre, adresse: adresse.trim() || store.adresse }, actorId);
}
