import { CLASSES as SEED_CLASSES, SALLES as SEED_SALLES, FILIERES, NIVEAUX } from "./mockData";

/** Classe pédagogique = groupe d'étudiants (ex. LPIG L1 A 2025-2026) */
export interface ClassePedagogiqueRecord {
  id: string;
  nom: string;
  filiere: string;
  filiereId: string;
  niveau: string;
  niveauId: string;
  inscrits: number;
  max: number;
  delegue: string;
  annee: string;
  salleParDefautId?: string;
  cloturee?: boolean;
  dateCloture?: string;
  clotureePar?: string;
  observationCloture?: string;
}

/** Classe physique = local / salle (ex. RDC 1A) — nom stable */
export interface SallePhysiqueRecord {
  id: string;
  nom: string;
  type: string;
  capacite: number;
  batiment: string;
  etage: string;
  /** Matériel pédagogique uniquement (pas wifi/clim) */
  equipements: string[];
  statut: "actif" | "en_maintenance" | "inactif";
}

interface StructureStore {
  classes: ClassePedagogiqueRecord[];
  salles: SallePhysiqueRecord[];
}

const STORAGE_KEY = "edumanage-structure-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeStructure(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Équipements pédagogiques retenus (CR réunion) */
export const EQUIPEMENTS_PEDAGOGIQUES = [
  "Vidéoprojecteur",
  "Ordinateurs",
  "Tableau blanc",
  "Tableau noir",
  "Écran",
];

function normalizeEquipements(list: string[]): string[] {
  const map: Record<string, string> = {
    Projecteur: "Vidéoprojecteur",
    Wifi: "",
    Climatisation: "",
    Sonorisation: "",
    Tableau: "Tableau blanc",
  };
  const out = new Set<string>();
  for (const e of list) {
    const mapped = map[e] !== undefined ? map[e] : e;
    if (mapped && EQUIPEMENTS_PEDAGOGIQUES.includes(mapped)) out.add(mapped);
  }
  return [...out];
}

function seedClasses(): ClassePedagogiqueRecord[] {
  return SEED_CLASSES.map((c) => {
    const niveau = NIVEAUX.find((n) => n.filiereId === c.filiereId && n.alias === c.niveau);
    return {
      ...c,
      niveauId: niveau?.id ?? "",
      salleParDefautId: undefined,
    };
  });
}

function seedSalles(): SallePhysiqueRecord[] {
  return SEED_SALLES.map((s) => ({
    id: s.id,
    nom: s.nom,
    type: s.type,
    capacite: s.capacite,
    batiment: s.batiment,
    etage: s.nom.includes("RDC") ? "RDC" : "",
    equipements: normalizeEquipements(s.equipements),
    statut: s.statut as SallePhysiqueRecord["statut"],
  }));
}

function buildFresh(): StructureStore {
  return { classes: seedClasses(), salles: seedSalles() };
}

function load(): StructureStore {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<StructureStore>;
        const fresh = buildFresh();
        return {
          classes: parsed.classes ?? fresh.classes,
          salles: parsed.salles ?? fresh.salles,
        };
      } catch {
        /* fallthrough */
      }
    }
  }
  return buildFresh();
}

let store = load();

function persist() {
  // Recrée les références des tableaux à chaque écriture : useSyncExternalStore
  // compare par égalité de référence, une mutation en place (push/unshift/Object.assign)
  // sur le même tableau ne déclenche donc aucun re-rendu sans ce clonage.
  store = { classes: store.classes.slice(), salles: store.salles.slice() };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (err) {
      console.error("[EduManage] structure persist failed", err);
    }
  }
  notify();
}

if (typeof window !== "undefined") persist();

export function getClasses(): ClassePedagogiqueRecord[] {
  return store.classes;
}

export function getSalles(): SallePhysiqueRecord[] {
  return store.salles;
}

export function getClasseById(id: string) {
  return store.classes.find((c) => c.id === id);
}

export function getSalleById(id: string) {
  return store.salles.find((s) => s.id === id);
}

export function findClassePedagogique(filiereId: string, niveau: string, annee: string) {
  return store.classes.find(
    (c) => c.filiereId === filiereId && c.niveau === niveau && c.annee === annee,
  );
}

export interface ClassePayload {
  nom: string;
  filiereId: string;
  niveauId: string;
  max: number;
  annee: string;
  delegue?: string;
  salleParDefautId?: string;
}

export function upsertClasse(payload: ClassePayload, id?: string): ClassePedagogiqueRecord {
  const filiere = FILIERES.find((f) => f.id === payload.filiereId);
  const niveau = NIVEAUX.find((n) => n.id === payload.niveauId);
  const base = {
    nom: payload.nom.toUpperCase().trim(),
    filiere: filiere?.code ?? "",
    filiereId: payload.filiereId,
    niveau: niveau?.alias ?? "",
    niveauId: payload.niveauId,
    max: payload.max,
    annee: payload.annee,
    delegue: payload.delegue ?? "",
    salleParDefautId: payload.salleParDefautId,
  };

  if (id) {
    const existing = store.classes.find((c) => c.id === id);
    if (existing) {
      Object.assign(existing, base);
      persist();
      return existing;
    }
  }

  const row: ClassePedagogiqueRecord = {
    id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    inscrits: 0,
    ...base,
  };
  store.classes.unshift(row);
  persist();
  return row;
}

export function deleteClasse(id: string) {
  store.classes = store.classes.filter((c) => c.id !== id);
  persist();
}

export function cloturerClasses(classeIds: string[], observations: Record<string, string>, clotureePar: string): void {
  const dateCloture = new Date().toISOString().slice(0, 10);
  for (const id of classeIds) {
    const c = store.classes.find((x) => x.id === id);
    if (!c) continue;
    c.cloturee = true;
    c.dateCloture = dateCloture;
    c.clotureePar = clotureePar;
    c.observationCloture = observations[id]?.trim() || undefined;
  }
  persist();
}

export function incrementClasseEffectif(classeId: string, delta = 1) {
  const c = store.classes.find((x) => x.id === classeId);
  if (!c) return;
  c.inscrits = Math.max(0, c.inscrits + delta);
  persist();
}

export interface SallePayload {
  nom: string;
  type: string;
  capacite: number;
  batiment: string;
  etage?: string;
  equipements: string[];
  statut: SallePhysiqueRecord["statut"];
}

export function upsertSalle(payload: SallePayload, id?: string): SallePhysiqueRecord {
  const base = {
    nom: payload.nom.trim(),
    type: payload.type,
    capacite: payload.capacite,
    batiment: payload.batiment,
    etage: payload.etage ?? "",
    equipements: normalizeEquipements(payload.equipements),
    statut: payload.statut,
  };

  if (id) {
    const existing = store.salles.find((s) => s.id === id);
    if (existing) {
      Object.assign(existing, base);
      persist();
      return existing;
    }
  }

  const row: SallePhysiqueRecord = { id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...base };
  store.salles.unshift(row);
  persist();
  return row;
}

export function deleteSalle(id: string) {
  store.salles = store.salles.filter((s) => s.id !== id);
  persist();
}

/** Affecte une salle physique par défaut à une classe pédagogique */
export function assignSalleToClasse(classeId: string, salleId: string | undefined) {
  const c = store.classes.find((x) => x.id === classeId);
  if (!c) return;
  c.salleParDefautId = salleId;
  persist();
}
