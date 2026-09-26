import { getAnneesAcademiques } from "./studentStore";
import { decalerDeNAns, premiereAnneeCivile } from "@/lib/anneeAcademique";

const STORAGE_KEY = "edumanage-grille-frais-v1";

export type ModaliteFrais = "avant_inscription" | "echeances";

export interface EcheancePersonnalisee {
  date: string;
  montant: number;
}

export interface LigneGrilleFrais {
  id: string;
  /** Référence vers financeSettingsStore.typeFraisStore — source de vérité du libellé.
   * Optionnel pour rester compatible avec les lignes créées avant cette liaison (import Excel,
   * anciennes grilles) : dans ce cas `intitule` reste le seul libellé disponible. */
  typeFraisId?: string;
  intitule: string;
  montant: number;
  modalite: ModaliteFrais;
  nbEcheances?: number;
  /** Date de la première échéance — date complète ISO ("2026-11-10"). Les lignes saisies avant le
   * passage à la date complète gardent l'ancien format "JJ/MM", résolu via resoudreDateGrille().
   * Absente = échéances mensuelles consécutives se terminant à dateLimite. Présente avec dateLimite
   * = les échéances sont réparties uniformément entre les deux dates. */
  dateDebut?: string;
  /** Date de la dernière échéance — date complète ISO, ou "JJ/MM" pour les lignes anciennes. */
  dateLimite?: string;
  /** Échéances définies manuellement (date + montant chacune) — remplace le partage automatique
   * par nbEcheances/dateLimite quand présent. La somme doit égaler `montant`. */
  echeancesPersonnalisees?: EcheancePersonnalisee[];
}

export interface GrilleFraisRecord {
  id: string;
  filiereId: string;
  niveau: string;
  annee: string;
  modeleFraisId: string;
  lignes: LigneGrilleFrais[];
}

export function makeGrilleFraisId(filiereId: string, niveau: string, annee: string, modeleFraisId: string): string {
  return `${filiereId}:${niveau}:${annee}:${modeleFraisId}`;
}

export interface EcheanceCalculee {
  /** Position 1-based parmi les échéances de la ligne (ex: 3 sur 8). */
  index: number;
  date: string;
  montant: number;
}

function addMonthsIso(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Répartit `total` en `n` parts entières, en ajoutant le reliquat d'arrondi aux premières parts. */
function splitMontantEgal(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => (i < remainder ? base + 1 : base));
}

/** Répartit `n` dates uniformément entre `startIso` et `endIso` inclus (la première échéance
 * tombe sur la date de début, la dernière sur la date de fin). */
function evenlySpacedDates(startIso: string, endIso: string, n: number): string[] {
  if (n <= 1) return [endIso];
  const start = new Date(`${startIso}T12:00:00`).getTime();
  const end = new Date(`${endIso}T12:00:00`).getTime();
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => new Date(start + step * i).toISOString().slice(0, 10));
}

export function estDateIso(valeur: string | undefined): boolean {
  return !!valeur && /^\d{4}-\d{2}-\d{2}$/.test(valeur);
}

/** Période couverte par une année scolaire : ses dates réelles de rentrée et de fin quand elles
 * sont renseignées (Années académiques), sinon 1er septembre → 31 août. */
export function periodeAnneeScolaire(anneeScolaire: string): { debut: string; fin: string; definie: boolean } | undefined {
  const record = getAnneesAcademiques().find((a) => a.libelle === anneeScolaire);
  if (record?.dateDebut && record.dateFin) return { debut: record.dateDebut, fin: record.dateFin, definie: true };
  const an1 = premiereAnneeCivile(anneeScolaire);
  if (!Number.isFinite(an1)) return undefined;
  return { debut: `${an1}-09-01`, fin: `${an1 + 1}-08-31`, definie: false };
}

/** Date réelle (ISO) d'une date de ligne grille. Une date complète est renvoyée telle quelle ; une
 * date ancienne "JJ/MM" est rattachée à l'année scolaire : les mois à partir du mois de rentrée
 * tombent sur la première année civile, les autres sur la seconde (rentrée en novembre → novembre
 * et décembre en 2026, janvier à octobre en 2027 pour 2026-2027). */
export function resoudreDateGrille(anneeScolaire: string, valeur: string): string | undefined {
  if (estDateIso(valeur)) return valeur;
  const [jourStr, moisStr] = valeur.split("/");
  const jour = Number(jourStr);
  const mois = Number(moisStr);
  const an1 = premiereAnneeCivile(anneeScolaire);
  if (!jour || !mois || !Number.isFinite(an1)) return undefined;
  const periode = periodeAnneeScolaire(anneeScolaire);
  const moisRentree = periode ? Number(periode.debut.slice(5, 7)) : 9;
  const annee = mois >= moisRentree ? an1 : an1 + 1;
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** Normalise une date saisie ou importée : ISO, "JJ/MM/AAAA" et numéro de série Excel deviennent
 * une date ISO ; "JJ/MM" (ancien format) est conservé tel quel. Renvoie undefined si illisible. */
export function normaliserDateGrille(valeur: unknown): string | undefined {
  if (typeof valeur === "number" && valeur > 0) {
    // Numéro de série Excel (jours depuis le 30/12/1899).
    return new Date(Date.UTC(1899, 11, 30) + Math.round(valeur) * 86400000).toISOString().slice(0, 10);
  }
  const txt = String(valeur ?? "").trim();
  if (!txt) return undefined;
  if (estDateIso(txt)) return txt;
  const complet = txt.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (complet) return `${complet[3]}-${complet[2].padStart(2, "0")}-${complet[1].padStart(2, "0")}`;
  const court = txt.match(/^(\d{1,2})[/.-](\d{1,2})$/);
  if (court) return `${court[1].padStart(2, "0")}/${court[2].padStart(2, "0")}`;
  return undefined;
}

/** Affichage d'une date de ligne grille : "10/06/2027" pour une date complète, "10/06" sinon. */
export function formatDateGrille(valeur: string | undefined): string {
  if (!valeur) return "";
  if (estDateIso(valeur)) return `${valeur.slice(8, 10)}/${valeur.slice(5, 7)}/${valeur.slice(0, 4)}`;
  return valeur;
}

/** Recopie une ligne vers une autre année scolaire en décalant ses dates complètes (début, fin,
 * échéances personnalisées) du même nombre d'années. Les dates anciennes "JJ/MM" n'ont pas
 * d'année : elles se rattachent d'elles-mêmes à la nouvelle année. */
export function decalerLigneGrille(ligne: LigneGrilleFrais, nbAnnees: number): LigneGrilleFrais {
  if (nbAnnees === 0) return { ...ligne };
  const decaler = (d?: string) => (d && estDateIso(d) ? decalerDeNAns(d, nbAnnees) : d);
  return {
    ...ligne,
    dateDebut: decaler(ligne.dateDebut),
    dateLimite: decaler(ligne.dateLimite),
    echeancesPersonnalisees: ligne.echeancesPersonnalisees?.map((e) => ({ ...e, date: decaler(e.date) ?? e.date })),
  };
}

/** Calcule les échéances réelles (date + montant) d'une ligne en modalité "echeances". Si des
 * échéances personnalisées ont été définies (date + montant par échéance), elles priment sur le
 * partage automatique. Sinon, le montant est réparti sur nbEcheances : si une dateDebut est
 * définie, les échéances sont espacées uniformément entre dateDebut et dateLimite ; sinon
 * (comportement historique) elles tombent sur des mois consécutifs se terminant à dateLimite.
 * Une ligne "avant_inscription", ou sans dateLimite exploitable, renvoie une échéance unique. */
/** Nombre d'échéances effectif d'une ligne — la longueur des échéances personnalisées si elles
 * existent, sinon nbEcheances. Sert à afficher "Échéance X/Y" de façon cohérente dans les deux cas. */
export function nbEcheancesEffectif(ligne: LigneGrilleFrais): number {
  return ligne.echeancesPersonnalisees?.length ?? ligne.nbEcheances ?? 1;
}

export function calculerEcheances(ligne: LigneGrilleFrais, anneeScolaire: string): EcheanceCalculee[] {
  if (ligne.echeancesPersonnalisees && ligne.echeancesPersonnalisees.length > 0) {
    return ligne.echeancesPersonnalisees.map((e, i) => ({ index: i + 1, date: e.date, montant: e.montant }));
  }
  const n = Math.max(1, ligne.nbEcheances ?? 1);
  const dateFinale = ligne.dateLimite ? resoudreDateGrille(anneeScolaire, ligne.dateLimite) : undefined;
  if (n <= 1 || !dateFinale) {
    return [{ index: 1, date: dateFinale ?? new Date().toISOString().slice(0, 10), montant: ligne.montant }];
  }
  const montants = splitMontantEgal(ligne.montant, n);
  const dateInitiale = ligne.dateDebut ? resoudreDateGrille(anneeScolaire, ligne.dateDebut) : undefined;
  if (dateInitiale) {
    const dates = evenlySpacedDates(dateInitiale, dateFinale, n);
    return montants.map((montant, i) => ({ index: i + 1, date: dates[i], montant }));
  }
  return montants.map((montant, i) => ({
    index: i + 1,
    date: addMonthsIso(dateFinale, -(n - 1 - i)),
    montant,
  }));
}

/** Aucune grille préchargée : chaque grille est saisie (ou importée) par l'administration. */
function seed(): GrilleFraisRecord[] {
  return [];
}

/** Grille de démonstration autrefois préchargée (filière inexistante « f1 », montants inventés) :
 * retirée aussi des navigateurs qui l'avaient déjà enregistrée. */
const ANCIENNE_GRILLE_DEMO_ID = makeGrilleFraisId("f1", "L3", "2025-2026", "mf-seed-2");

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): GrilleFraisRecord[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    return (JSON.parse(raw) as GrilleFraisRecord[]).filter((g) => g.id !== ANCIENNE_GRILLE_DEMO_ID);
  } catch {
    return seed();
  }
}

let store: GrilleFraisRecord[] = load();

function persist() {
  // Nouvelle référence de tableau : useSyncExternalStore compare par
  // Object.is et ne re-rend pas si getGrillesFrais() renvoie la même référence.
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeGrillesFrais(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getGrillesFrais(): GrilleFraisRecord[] {
  return store;
}

export function getGrilleFrais(filiereId: string, niveau: string, annee: string, modeleFraisId: string): GrilleFraisRecord | undefined {
  return store.find((g) => g.id === makeGrilleFraisId(filiereId, niveau, annee, modeleFraisId));
}

/** Modèles de frais pour lesquels une grille (avec au moins une ligne) est configurée pour cette filière/niveau/année. */
export function getModelesFraisDisponibles(filiereId: string, niveau: string, annee: string): string[] {
  return store
    .filter((g) => g.filiereId === filiereId && g.niveau === niveau && g.annee === annee && g.lignes.length > 0)
    .map((g) => g.modeleFraisId);
}

export interface UpsertGrilleFraisPayload {
  filiereId: string;
  niveau: string;
  annee: string;
  modeleFraisId: string;
  lignes: LigneGrilleFrais[];
}

/** Remplace intégralement la grille tarifaire pour cette combinaison filière/niveau/année/modèle de frais. */
export function upsertGrilleFrais(payload: UpsertGrilleFraisPayload): GrilleFraisRecord {
  const id = makeGrilleFraisId(payload.filiereId, payload.niveau, payload.annee, payload.modeleFraisId);
  const record: GrilleFraisRecord = {
    id,
    filiereId: payload.filiereId,
    niveau: payload.niveau,
    annee: payload.annee,
    modeleFraisId: payload.modeleFraisId,
    lignes: payload.lignes,
  };
  const idx = store.findIndex((g) => g.id === id);
  if (idx >= 0) store[idx] = record;
  else store.push(record);
  persist();
  return record;
}

export function makeLigneGrilleFraisId(): string {
  return `lgf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Supprime intégralement une grille tarifaire (combinaison filière/niveau/année/modèle de frais). */
export function supprimerGrilleFrais(id: string): void {
  store = store.filter((g) => g.id !== id);
  persist();
}
