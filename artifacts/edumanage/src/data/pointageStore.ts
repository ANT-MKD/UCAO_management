const STORAGE_KEY = "edumanage-pointages-v1";

export type PointageStatut = "brouillon" | "soumis" | "valide" | "rejete";

export interface PointageRecord {
  id: string;
  teacherId: string;
  ecId: string;
  classeId: string;
  annee: string;
  seanceId?: string;
  /** Cahier de séance validé dont ce pointage a été créé automatiquement. */
  cahierId?: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  type: "CM" | "TD" | "TP" | "EX";
  salleId: string;
  volumePointe: number;
  remarque?: string;
  statut: PointageStatut;
  motifRejet?: string;
  createdAt: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): PointageRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PointageRecord[];
  } catch {
    return [];
  }
}

let store: PointageRecord[] = load();

function persist() {
  // Nouvelle référence de tableau : useSyncExternalStore compare par
  // Object.is et ne re-rend pas si getPointages() renvoie la même référence.
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribePointages(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPointages(): PointageRecord[] {
  return store;
}

export function getPointagesForCourse(
  teacherId: string,
  ecId: string,
  classeId: string,
  annee: string,
): PointageRecord[] {
  return store.filter(
    (p) =>
      p.teacherId === teacherId &&
      p.ecId === ecId &&
      p.classeId === classeId &&
      p.annee === annee,
  );
}

export function addPointage(record: PointageRecord): void {
  store.push(record);
  persist();
}

export function updatePointageStatut(
  id: string,
  statut: PointageStatut,
  motifRejet?: string,
): PointageRecord | undefined {
  const idx = store.findIndex((p) => p.id === id);
  if (idx < 0) return undefined;
  store[idx] = {
    ...store[idx],
    statut,
    motifRejet: statut === "rejete" ? motifRejet?.trim() || store[idx].motifRejet : undefined,
  };
  persist();
  return store[idx];
}

export function findPointageDuplicate(
  teacherId: string,
  ecId: string,
  classeId: string,
  date: string,
  heureDebut: string,
  heureFin: string,
  excludeId?: string,
): PointageRecord | undefined {
  return store.find(
    (p) =>
      p.id !== excludeId &&
      p.teacherId === teacherId &&
      p.ecId === ecId &&
      p.classeId === classeId &&
      p.date === date &&
      p.heureDebut === heureDebut &&
      p.heureFin === heureFin &&
      p.statut !== "rejete",
  );
}

export function makePointageId(): string {
  return `ptg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const TYPES_POINTAGE = ["CM", "TD", "TP", "EX"] as const;

export interface CahierPourPointage {
  id: string;
  seanceId: string;
  ecId: string;
  classeId: string;
  annee: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  typeSeance: string;
  salleId: string;
  ec: string;
}

/** Cahier de séance validé → pointage « en attente » : le professeur a déjà déclaré la séance
 * réalisée, l'administration n'a plus qu'à confirmer le pointage (qui alimente ensuite le
 * décompte) au lieu de le ressaisir. Rien n'est créé si ce créneau est déjà pointé. */
export function creerPointageDepuisCahier(cahier: CahierPourPointage, teacherId: string): PointageRecord | undefined {
  const [h1, m1] = cahier.heureDebut.split(":").map(Number);
  const [h2, m2] = cahier.heureFin.split(":").map(Number);
  const minutes = h2 * 60 + m2 - (h1 * 60 + m1);
  if (!teacherId || !(minutes > 0)) return undefined;
  if (findPointageDuplicate(teacherId, cahier.ecId, cahier.classeId, cahier.date, cahier.heureDebut, cahier.heureFin)) return undefined;
  if (store.some((p) => p.cahierId === cahier.id && p.statut !== "rejete")) return undefined;
  const type = (TYPES_POINTAGE as readonly string[]).includes(cahier.typeSeance) ? (cahier.typeSeance as PointageRecord["type"]) : "CM";
  const record: PointageRecord = {
    id: makePointageId(),
    teacherId,
    ecId: cahier.ecId,
    classeId: cahier.classeId,
    annee: cahier.annee,
    seanceId: cahier.seanceId,
    cahierId: cahier.id,
    date: cahier.date,
    heureDebut: cahier.heureDebut,
    heureFin: cahier.heureFin,
    type,
    salleId: cahier.salleId,
    volumePointe: Math.round((minutes / 60) * 100) / 100,
    remarque: `Créé depuis le cahier de séance validé — ${cahier.ec}`,
    statut: "soumis",
    createdAt: new Date().toISOString(),
  };
  store.push(record);
  persist();
  return record;
}
