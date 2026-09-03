import { NIVEAUX } from "./mockData";

export interface NiveauRecord {
  id: string;
  nom: string;
  alias: string;
  cycle: string;
  cycleId?: string;
  filiere: string;
  filiereId: string;
  /** Passage conditionnel (AJAC) : un étudiant qui n'atteint pas le seuil de crédits plein de la
   * règle de validation "année" mais dépasse creditDetteMin est quand même autorisé à monter au
   * niveau suivant, avec ses UE non validées comme dette. Absent/false = aucune tolérance (comme
   * avant), le passage reste tout-ou-rien. */
  passageConditionnelAutorise?: boolean;
  /** Seuil minimal de crédits pour bénéficier du passage conditionnel depuis ce niveau — ignoré
   * si passageConditionnelAutorise est faux. */
  creditDetteMin?: number;
  /** Crédits cumulés (tous niveaux antérieurs du cursus confondus) requis pour pouvoir s'inscrire
   * à CE niveau — le garde-fou d'entrée (ex. 120 crédits requis pour L3). Absent = aucun contrôle,
   * l'inscription au niveau suit uniquement la délibération du niveau précédent. */
  creditsRequisEntree?: number;
}

const STORAGE_KEY = "edumanage-niveau-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** NIVEAUX (data/mockData.ts) est importé et lu directement (NIVEAUX.find(...), NIVEAUX.map(...))
 * par une trentaine d'autres fichiers (finance, notes, absences, curriculum...). Ce store mute
 * donc ce même tableau en place, comme filiereStore.ts, pour que ces lectures existantes restent
 * à jour sans devoir être réécrites. Seul getNiveaux() (usage réactif) renvoie un instantané. */
const niveaux = NIVEAUX as unknown as NiveauRecord[];

function loadPersisted() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as NiveauRecord[];
    niveaux.splice(0, niveaux.length, ...saved);
  } catch {
    /* conserve le seed en cas d'erreur de lecture */
  }
}

let snapshot: NiveauRecord[] = [];

function refreshSnapshot() {
  snapshot = [...niveaux];
}

loadPersisted();
refreshSnapshot();

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(niveaux));
  }
  refreshSnapshot();
  notify();
}

export function subscribeNiveaux(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getNiveaux(): NiveauRecord[] {
  return snapshot;
}

export function getNiveauById(id: string): NiveauRecord | undefined {
  return niveaux.find((n) => n.id === id);
}

export type NiveauInput = Omit<NiveauRecord, "id">;

export function addNiveau(payload: NiveauInput): NiveauRecord {
  const record: NiveauRecord = { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...payload };
  niveaux.push(record);
  persist();
  return record;
}

export function updateNiveau(id: string, patch: Partial<NiveauInput>) {
  const n = niveaux.find((x) => x.id === id);
  if (!n) return;
  Object.assign(n, patch);
  persist();
}

export function deleteNiveau(id: string) {
  const idx = niveaux.findIndex((n) => n.id === id);
  if (idx >= 0) niveaux.splice(idx, 1);
  persist();
}
