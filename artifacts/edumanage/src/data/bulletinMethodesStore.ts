import { getCodesMethodesDisponibles, type NiveauMethodeCalcul } from "@/lib/bulletinCalculs";

const STORAGE_KEY = "edumanage-bulletin-methodes-store-v1";

export type { NiveauMethodeCalcul };

export interface MethodeCalculRecord {
  id: string;
  /** Clé technique — doit correspondre à une fonction réellement enregistrée dans
   * lib/bulletinCalculs.ts pour ce niveau (voir getCodesMethodesDisponibles). */
  code: string;
  intitule: string;
  niveau: NiveauMethodeCalcul;
  description?: string;
  actif: boolean;
}

const LABELS_DEFAUT: Record<string, string> = {
  calculMoyenneCoefficient: "Moyenne pondérée par coefficient",
  calculMoyenneCredit: "Moyenne pondérée par crédit",
  calculMoyenneDefault: "Moyenne simple (par défaut)",
  calculMoyenneSommeMoyenne: "Somme des moyennes",
  calculSessionMoyenneByUEAndCreditUE: "Moyenne session par UE et crédit UE",
  calculMoyenneAvecBaseNotation: "Moyenne avec base de notation",
  calculMoyenneMethodeSupdeco: "Méthode Supdeco",
  calculMoyenneProgrammeESMT: "Méthode ESMT (préparatoire + examen×2)/3",
};

const DESCRIPTIONS_DEFAUT: Record<string, string> = {
  calculMoyenneCoefficient: "Moyenne des éléments pondérée par leur coefficient.",
  calculMoyenneCredit: "Moyenne des éléments pondérée par leurs crédits ECTS.",
  calculMoyenneDefault: "Moyenne arithmétique simple, sans pondération.",
  calculMoyenneSommeMoyenne: "Somme brute des moyennes, sans division.",
  calculSessionMoyenneByUEAndCreditUE: "Moyenne de session pondérée par crédit de chaque UE.",
  calculMoyenneAvecBaseNotation: "Moyenne pondérée par coefficient, normalisée par le barème de notation.",
  calculMoyenneMethodeSupdeco: "Formule spécifique à Supdeco (approximée par une pondération crédits).",
  calculMoyenneProgrammeESMT: "(moyenne classe préparatoire + moyenne classe d'examen × 2) / 3.",
};

function seedForNiveau(niveau: NiveauMethodeCalcul): MethodeCalculRecord[] {
  return getCodesMethodesDisponibles(niveau).map((code) => ({
    id: `meth-${niveau}-${code}`,
    code,
    intitule: LABELS_DEFAUT[code] ?? code,
    niveau,
    description: DESCRIPTIONS_DEFAUT[code],
    actif: true,
  }));
}

function seed(): MethodeCalculRecord[] {
  const niveaux: NiveauMethodeCalcul[] = ["moyenneUe", "moyenneSession", "moyenneAnnee", "moyenneProgramme"];
  return niveaux.flatMap(seedForNiveau);
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): MethodeCalculRecord[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as MethodeCalculRecord[];
    // Complète avec les méthodes techniques nouvellement enregistrées côté code, absentes du
    // localStorage existant (ex. après un déploiement qui ajoute une méthode).
    const known = new Set(parsed.map((m) => `${m.niveau}:${m.code}`));
    const fresh = seed().filter((m) => !known.has(`${m.niveau}:${m.code}`));
    return [...parsed, ...fresh];
  } catch {
    return seed();
  }
}

let store: MethodeCalculRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeBulletinMethodes(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getMethodesCalcul(): MethodeCalculRecord[] {
  return store;
}

export function getMethodesCalculParNiveau(niveau: NiveauMethodeCalcul): MethodeCalculRecord[] {
  return store.filter((m) => m.niveau === niveau);
}

export function getMethodesCalculActivesParNiveau(niveau: NiveauMethodeCalcul): MethodeCalculRecord[] {
  return store.filter((m) => m.niveau === niveau && m.actif);
}

export function getMethodeCalculById(id: string): MethodeCalculRecord | undefined {
  return store.find((m) => m.id === id);
}

export interface MethodeCalculPatch {
  intitule: string;
  description?: string;
  actif: boolean;
}

/** Renomme/décrit/active-désactive une méthode — le code technique (donc la formule réellement
 * exécutée) n'est jamais modifiable depuis l'UI : il reste ancré à une fonction de
 * lib/bulletinCalculs.ts. */
export function updateMethodeCalcul(id: string, patch: MethodeCalculPatch): void {
  store = store.map((m) => (m.id === id ? { ...m, ...patch } : m));
  persist();
}
