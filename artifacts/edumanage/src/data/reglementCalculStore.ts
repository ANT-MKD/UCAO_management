import { ecrireStockage } from "@/lib/stockageLocal";
import { getScolariteConfigs } from "./scolariteConfigStore";
import { getAnneeActuelle, isAnneeCloturee, logAudit } from "./studentStore";
import { FILIERES } from "./mockData";
import { ETAPES_FORMULES, validerFormule, type FormulesCalcul } from "./formulesCalcul";

const STORAGE_KEY = "edumanage-reglements-calcul-v1";

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

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") ecrireStockage(STORAGE_KEY, JSON.stringify(store));
  listeners.forEach((fn) => fn());
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

export function enregistrerReglement(payload: ReglementPayload, id: string | undefined, par: string): { ok: boolean; reason?: string; reglement?: ReglementCalcul } {
  const motif = verifierReglement(payload, id);
  if (motif) return { ok: false, reason: motif };
  const maintenant = new Date().toISOString();
  const propre = { nom: payload.nom.trim(), annee: payload.annee, filiereIds: [...new Set(payload.filiereIds)], formules: nettoyer(payload.formules) };
  const existant = id ? store.find((r) => r.id === id) : undefined;
  let reglement: ReglementCalcul;
  if (existant) {
    reglement = { ...existant, ...propre, modifiePar: par, modifieLe: maintenant };
    store = store.map((r) => (r.id === id ? reglement : r));
  } else {
    reglement = { id: `reglement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...propre, creePar: par, creeLe: maintenant };
    store = [...store, reglement];
  }
  logAudit(par, existant ? "modification_reglement_calcul" : "creation_reglement_calcul", "reglement_calcul", reglement.id, `${reglement.nom} — ${reglement.annee}`);
  persist();
  return { ok: true, reglement };
}

export function supprimerReglement(id: string, par: string): { ok: boolean; reason?: string } {
  const r = store.find((x) => x.id === id);
  if (!r) return { ok: false, reason: "Règlement introuvable." };
  if (isAnneeCloturee(r.annee)) return { ok: false, reason: `L'année ${r.annee} est clôturée : son règlement est conservé.` };
  store = store.filter((x) => x.id !== id);
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
