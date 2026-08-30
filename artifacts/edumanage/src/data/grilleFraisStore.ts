const STORAGE_KEY = "edumanage-grille-frais-v1";

export type ModaliteFrais = "avant_inscription" | "echeances";

export interface LigneGrilleFrais {
  id: string;
  intitule: string;
  montant: number;
  modalite: ModaliteFrais;
  nbEcheances?: number;
  dateLimite?: string;
}

export interface GrilleFraisRecord {
  id: string;
  filiereId: string;
  niveau: string;
  annee: string;
  modeleFraisId: string;
  tauxTaxe: number;
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

/** `dateLimite` d'une ligne grille est un jour/mois ("10/12") sans année : on déduit l'année
 * civile réelle à partir de l'année scolaire (ex: "2025-2026") — septembre à décembre tombent
 * sur la première année, janvier à août sur la seconde. */
function dateLimiteVersISO(anneeScolaire: string, dateLimite: string): string | undefined {
  const [jourStr, moisStr] = dateLimite.split("/");
  const jour = Number(jourStr);
  const mois = Number(moisStr);
  const [an1, an2] = anneeScolaire.split("-").map(Number);
  if (!jour || !mois || !an1) return undefined;
  const annee = mois >= 9 ? an1 : (an2 || an1 + 1);
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** Calcule les échéances réelles (date + montant) d'une ligne en modalité "echeances", en
 * répartissant son montant sur nbEcheances mois consécutifs se terminant à sa dateLimite. Une
 * ligne "avant_inscription", ou sans dateLimite exploitable, renvoie une échéance unique. */
export function calculerEcheances(ligne: LigneGrilleFrais, anneeScolaire: string): EcheanceCalculee[] {
  const n = Math.max(1, ligne.nbEcheances ?? 1);
  const dateFinale = ligne.dateLimite ? dateLimiteVersISO(anneeScolaire, ligne.dateLimite) : undefined;
  if (n <= 1 || !dateFinale) {
    return [{ index: 1, date: dateFinale ?? new Date().toISOString().slice(0, 10), montant: ligne.montant }];
  }
  const montants = splitMontantEgal(ligne.montant, n);
  return montants.map((montant, i) => ({
    index: i + 1,
    date: addMonthsIso(dateFinale, -(n - 1 - i)),
    montant,
  }));
}

function seed(): GrilleFraisRecord[] {
  return [
    {
      id: makeGrilleFraisId("f1", "L3", "2025-2026", "mf-seed-2"),
      filiereId: "f1",
      niveau: "L3",
      annee: "2025-2026",
      modeleFraisId: "mf-seed-2",
      tauxTaxe: 18,
      lignes: [
        { id: "lgf-1", intitule: "Bureau des étudiants (BDE)", montant: 10000, modalite: "avant_inscription" },
        { id: "lgf-2", intitule: "Frais Sortie promotion", montant: 30000, modalite: "echeances", nbEcheances: 3, dateLimite: "10/05" },
        { id: "lgf-3", intitule: "Frais d'inscription", montant: 120000, modalite: "avant_inscription" },
        { id: "lgf-4", intitule: "Frais de scolarité", montant: 520000, modalite: "echeances", nbEcheances: 8, dateLimite: "10/12" },
        { id: "lgf-5", intitule: "Mutuelle Santé", montant: 5000, modalite: "avant_inscription" },
        { id: "lgf-6", intitule: "Scolarité dernier mois", montant: 65000, modalite: "echeances", nbEcheances: 5, dateLimite: "10/12" },
      ],
    },
  ];
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): GrilleFraisRecord[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    return JSON.parse(raw) as GrilleFraisRecord[];
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
  tauxTaxe: number;
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
    tauxTaxe: payload.tauxTaxe,
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
