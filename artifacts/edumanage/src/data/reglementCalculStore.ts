import { ecrireStockage } from "@/lib/stockageLocal";
import { getScolariteConfigs } from "./scolariteConfigStore";
import { getAnneeActuelle, isAnneeCloturee, logAudit } from "./studentStore";
import { FILIERES } from "./mockData";
import { ETAPES_FORMULES, validerFormule, type FormulesCalcul } from "./formulesCalcul";

const STORAGE_KEY = "edumanage-reglements-calcul-v1";
const STORAGE_KEY_HISTORIQUE = "edumanage-reglements-historique-v1";

/** Règlement de calcul : un ensemble de formules, nommé, valable pour UNE année académique et
 * appliqué à une ou plusieurs filières. Les résultats d'une année suivent toujours le règlement
 * de cette année — préparer celui de l'année suivante ne change rien à l'année en cours. Une
 * filière sans règlement pour l'année suit simplement ses réglages (Paramétrage scolarité). */
export interface ReglementCalcul {
  id: string;
  nom: string;
  annee: string;
  filiereIds: string[];
  formules: FormulesCalcul;
  creePar: string;
  creeLe: string;
  modifiePar?: string;
  modifieLe?: string;
}

/** Une version d'un règlement : son contenu juste après l'action, qui l'a faite et quand. Chaque
 * enregistrement ajoute une version ; rien n'est jamais effacé de l'historique, même quand le
 * règlement est supprimé. */
export interface VersionReglement {
  id: string;
  reglementId: string;
  numero: number;
  /** reprise = version de départ d'un règlement qui existait avant l'historique. */
  action: "creation" | "modification" | "retour" | "suppression" | "reprise";
  nom: string;
  annee: string;
  filiereIds: string[];
  formules: FormulesCalcul;
  par: string;
  le: string;
  /** Pour un retour en arrière : la version dont on est reparti. */
  depuisVersion?: number;
}

const listeners = new Set<() => void>();

function nettoyer(f: FormulesCalcul): FormulesCalcul {
  return Object.fromEntries(ETAPES_FORMULES.map((e) => [e.cle, f[e.cle]?.trim()]).filter(([, t]) => !!t)) as FormulesCalcul;
}

/** Les formules de l'étape 1 (rangées sur la filière, sans année) deviennent un règlement de
 * l'année en cours — une seule fois, au premier chargement. */
function migrerFormulesDeFiliere(): ReglementCalcul[] {
  const annee = getAnneeActuelle();
  if (!annee) return [];
  return getScolariteConfigs()
    .filter((c) => c.formulesCalcul && Object.keys(nettoyer(c.formulesCalcul)).length > 0)
    .map((c) => ({
      id: `reglement-${c.filiereId}-${annee}`,
      nom: `Règlement ${c.filiere}`,
      annee,
      filiereIds: [c.filiereId],
      formules: nettoyer(c.formulesCalcul!),
      creePar: c.formulesModifieesPar ?? "Administration",
      creeLe: c.formulesModifieesLe ?? new Date().toISOString(),
    }));
}

function load(): ReglementCalcul[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return migrerFormulesDeFiliere();
    const parsed = JSON.parse(raw) as ReglementCalcul[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let store: ReglementCalcul[] = load();

function loadHistorique(): VersionReglement[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORIQUE) ?? "[]") as VersionReglement[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Un règlement créé avant l'historique reçoit une version de départ : son contenu actuel. */
function completerHistorique(versions: VersionReglement[]): VersionReglement[] {
  const manquantes = store
    .filter((r) => !versions.some((v) => v.reglementId === r.id))
    .map((r): VersionReglement => ({
      id: `version-${r.id}-1`,
      reglementId: r.id,
      numero: 1,
      action: "reprise",
      nom: r.nom,
      annee: r.annee,
      filiereIds: [...r.filiereIds],
      formules: { ...r.formules },
      par: r.modifiePar ?? r.creePar,
      le: r.modifieLe ?? r.creeLe,
    }));
  return manquantes.length ? [...versions, ...manquantes] : versions;
}

let historique: VersionReglement[] = completerHistorique(loadHistorique());

function persist() {
  store = store.slice();
  historique = historique.slice();
  if (typeof window !== "undefined") {
    ecrireStockage(STORAGE_KEY, JSON.stringify(store));
    ecrireStockage(STORAGE_KEY_HISTORIQUE, JSON.stringify(historique));
  }
  listeners.forEach((fn) => fn());
}

/** Versions d'un règlement, de la plus récente à la plus ancienne. */
export function getHistoriqueReglement(reglementId: string): VersionReglement[] {
  return historique.filter((v) => v.reglementId === reglementId).sort((a, b) => b.numero - a.numero);
}

export function getHistorique(): VersionReglement[] {
  return historique;
}

/** Règlements supprimés d'une année : leur dernière version (celle de la suppression). */
export function getReglementsSupprimes(annee: string): VersionReglement[] {
  const derniers = new Map<string, VersionReglement>();
  for (const v of historique) {
    const d = derniers.get(v.reglementId);
    if (!d || v.numero > d.numero) derniers.set(v.reglementId, v);
  }
  return [...derniers.values()].filter((v) => v.action === "suppression" && v.annee === annee && !store.some((r) => r.id === v.reglementId));
}

function ajouterVersion(r: Pick<ReglementCalcul, "id" | "nom" | "annee" | "filiereIds" | "formules">, action: VersionReglement["action"], par: string, le: string, depuisVersion?: number) {
  const precedentes = historique.filter((v) => v.reglementId === r.id);
  const numero = precedentes.reduce((m, v) => Math.max(m, v.numero), 0) + 1;
  historique = [...historique, {
    id: `version-${r.id}-${numero}`,
    reglementId: r.id,
    numero,
    action,
    nom: r.nom,
    annee: r.annee,
    filiereIds: [...r.filiereIds],
    formules: { ...r.formules },
    par,
    le,
    ...(depuisVersion ? { depuisVersion } : {}),
  }];
}

const memeContenu = (a: Pick<VersionReglement, "nom" | "filiereIds" | "formules">, b: Pick<VersionReglement, "nom" | "filiereIds" | "formules">) =>
  a.nom === b.nom
  && [...a.filiereIds].sort().join() === [...b.filiereIds].sort().join()
  && ETAPES_FORMULES.every((e) => (a.formules[e.cle] ?? "") === (b.formules[e.cle] ?? ""));

export interface DifferencesVersions {
  nom?: { avant: string; apres: string };
  filieresAjoutees: string[];
  filieresRetirees: string[];
  formules: { cle: string; titre: string; avant?: string; apres?: string }[];
}

/** Ce qui a changé d'une version à la suivante (sans version précédente : tout le contenu). */
export function differencesVersions(avant: VersionReglement | undefined, apres: VersionReglement): DifferencesVersions {
  const fa = avant?.formules ?? {};
  return {
    nom: avant && avant.nom !== apres.nom ? { avant: avant.nom, apres: apres.nom } : undefined,
    filieresAjoutees: apres.filiereIds.filter((f) => !avant?.filiereIds.includes(f)),
    filieresRetirees: (avant?.filiereIds ?? []).filter((f) => !apres.filiereIds.includes(f)),
    formules: ETAPES_FORMULES
      .filter((e) => (fa[e.cle] ?? "") !== (apres.formules[e.cle] ?? ""))
      .map((e) => ({ cle: e.cle, titre: e.titre, avant: fa[e.cle], apres: apres.formules[e.cle] })),
  };
}

export function subscribeReglements(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getReglements(): ReglementCalcul[] {
  return store;
}

export function getReglementsAnnee(annee: string): ReglementCalcul[] {
  return store.filter((r) => r.annee === annee);
}

/** Règlement appliqué à une filière pour une année (au plus un). */
export function reglementPour(filiereId: string, annee: string | undefined): ReglementCalcul | undefined {
  if (!annee) return undefined;
  return store.find((r) => r.annee === annee && r.filiereIds.includes(filiereId));
}

/** Formules en vigueur pour une filière une année donnée ({} = l'année suit les réglages). */
export function formulesPour(filiereId: string, annee: string | undefined): FormulesCalcul {
  return reglementPour(filiereId, annee)?.formules ?? {};
}

const nomFiliere = (id: string) => FILIERES.find((f) => f.id === id)?.nom ?? id;

export interface ReglementPayload {
  nom: string;
  annee: string;
  filiereIds: string[];
  formules: FormulesCalcul;
}

/** Motif du refus si le règlement ne peut pas être enregistré, sinon null. */
export function verifierReglement(payload: ReglementPayload, id?: string): string | null {
  if (!payload.nom.trim()) return "Donnez un nom au règlement.";
  if (!payload.annee) return "Choisissez l'année académique.";
  if (isAnneeCloturee(payload.annee)) return `L'année ${payload.annee} est clôturée : ses résultats ne peuvent plus changer.`;
  if (payload.filiereIds.length === 0) return "Choisissez au moins une filière.";
  for (const filiereId of payload.filiereIds) {
    const autre = store.find((r) => r.id !== id && r.annee === payload.annee && r.filiereIds.includes(filiereId));
    if (autre) return `${nomFiliere(filiereId)} a déjà le règlement « ${autre.nom} » pour ${payload.annee}.`;
  }
  for (const etape of ETAPES_FORMULES) {
    const texte = payload.formules[etape.cle]?.trim();
    if (!texte) continue;
    const motif = validerFormule(etape.cle, texte);
    if (motif) return `${etape.titre} : ${motif}`;
  }
  return null;
}

/** Enregistre un règlement et ajoute une version à son historique. depuisVersion : on revient au
 * contenu d'une ancienne version (l'id peut alors être celui d'un règlement supprimé, recréé). */
export function enregistrerReglement(payload: ReglementPayload, id: string | undefined, par: string, options: { depuisVersion?: number } = {}): { ok: boolean; reason?: string; reglement?: ReglementCalcul } {
  const motif = verifierReglement(payload, id);
  if (motif) return { ok: false, reason: motif };
  const maintenant = new Date().toISOString();
  const propre = { nom: payload.nom.trim(), annee: payload.annee, filiereIds: [...new Set(payload.filiereIds)], formules: nettoyer(payload.formules) };
  const existant = id ? store.find((r) => r.id === id) : undefined;
  const recree = !existant && !!id && historique.some((v) => v.reglementId === id);
  const derniere = existant ? getHistoriqueReglement(existant.id)[0] : undefined;
  let reglement: ReglementCalcul;
  if (existant) {
    reglement = { ...existant, ...propre, modifiePar: par, modifieLe: maintenant };
    store = store.map((r) => (r.id === id ? reglement : r));
  } else {
    reglement = { id: recree ? id! : `reglement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...propre, creePar: par, creeLe: maintenant };
    store = [...store, reglement];
  }
  // Un enregistrement sans aucun changement n'ajoute pas de version.
  if (!derniere || !memeContenu(derniere, reglement)) {
    const action = options.depuisVersion ? "retour" : existant ? "modification" : "creation";
    ajouterVersion(reglement, action, par, maintenant, options.depuisVersion);
  }
  const detail = options.depuisVersion ? ` (retour à la version ${options.depuisVersion})` : "";
  logAudit(par, existant ? "modification_reglement_calcul" : "creation_reglement_calcul", "reglement_calcul", reglement.id, `${reglement.nom} — ${reglement.annee}${detail}`);
  persist();
  return { ok: true, reglement };
}

export function supprimerReglement(id: string, par: string): { ok: boolean; reason?: string } {
  const r = store.find((x) => x.id === id);
  if (!r) return { ok: false, reason: "Règlement introuvable." };
  if (isAnneeCloturee(r.annee)) return { ok: false, reason: `L'année ${r.annee} est clôturée : son règlement est conservé.` };
  store = store.filter((x) => x.id !== id);
  ajouterVersion(r, "suppression", par, new Date().toISOString());
  logAudit(par, "suppression_reglement_calcul", "reglement_calcul", id, `${r.nom} — ${r.annee}`);
  persist();
  return { ok: true };
}

/** Prépare l'année suivante en recopiant les règlements d'une année (sans écraser ceux déjà
 * créés pour l'année cible). Renvoie le nombre de règlements copiés. */
export function copierReglements(source: string, cible: string, par: string): number {
  let copies = 0;
  for (const r of getReglementsAnnee(source)) {
    const libres = r.filiereIds.filter((f) => !reglementPour(f, cible));
    if (libres.length === 0) continue;
    const res = enregistrerReglement({ nom: r.nom.replace(source, cible), annee: cible, filiereIds: libres, formules: r.formules }, undefined, par);
    if (res.ok) copies++;
  }
  return copies;
}
