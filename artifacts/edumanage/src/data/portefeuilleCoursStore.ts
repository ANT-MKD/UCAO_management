const STORAGE_KEY = "edumanage-portefeuille-cours-v1";

export type ActionPortefeuille = "ajout" | "retrait";

/** Une exception au cursus par défaut d'une classe pour un étudiant précis : un cours ajouté
 * (ex. redoublant reprenant un seul EC d'un niveau déjà quitté, optionnelle choisie) ou retiré
 * (ex. cours déjà validé par équivalence/transfert). Journal audité, jamais de suppression
 * silencieuse — seule la dernière action pour un (étudiant, classe, EC) fait foi. */
export interface PortefeuilleCoursRecord {
  id: string;
  etudiantId: string;
  etudiant: string;
  matricule: string;
  classeId: string;
  classe: string;
  ecId: string;
  ec: string;
  action: ActionPortefeuille;
  dateAction: string;
  effectuePar: string;
  motif?: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribePortefeuilleCours(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

interface Persisted {
  records: PortefeuilleCoursRecord[];
}

function load(): Persisted {
  if (typeof window === "undefined") return { records: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [] };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return { records: parsed.records ?? [] };
  } catch {
    return { records: [] };
  }
}

let store: Persisted = load();

function persist() {
  store = { records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function getPortefeuilleCours(): PortefeuilleCoursRecord[] {
  return store.records;
}

/** Dernière action pour un (étudiant, classe, EC) — les nouveaux enregistrements sont ajoutés
 * en tête, donc le premier trouvé est le plus récent. Un ajout suivi d'un retrait (ou
 * l'inverse) annule le précédent : seule la dernière action compte. */
function derniereAction(etudiantId: string, classeId: string, ecId: string): ActionPortefeuille | undefined {
  return store.records.find((r) => r.etudiantId === etudiantId && r.classeId === classeId && r.ecId === ecId)?.action;
}

export function estEcRetireePourEtudiant(etudiantId: string, classeId: string, ecId: string): boolean {
  return derniereAction(etudiantId, classeId, ecId) === "retrait";
}

export function estEcAjouteePourEtudiant(etudiantId: string, classeId: string, ecId: string): boolean {
  return derniereAction(etudiantId, classeId, ecId) === "ajout";
}

/** Étudiants dont la dernière action pour ce (classe, EC) est un ajout — inclut les étudiants
 * d'une autre classe (ex. redoublant reprenant un seul cours d'un niveau déjà quitté). */
export function getEtudiantsAjoutesPourCours(classeId: string, ecId: string): string[] {
  const vus = new Set<string>();
  const resultat: string[] = [];
  for (const r of store.records) {
    if (r.classeId !== classeId || r.ecId !== ecId || vus.has(r.etudiantId)) continue;
    vus.add(r.etudiantId);
    if (r.action === "ajout") resultat.push(r.etudiantId);
  }
  return resultat;
}

/** Étudiants normalement membres de la classe dont la dernière action pour ce (classe, EC) est
 * un retrait — à exclure du cours malgré leur appartenance à la classe. */
export function getEtudiantsRetiresPourCours(classeId: string, ecId: string): string[] {
  const vus = new Set<string>();
  const resultat: string[] = [];
  for (const r of store.records) {
    if (r.classeId !== classeId || r.ecId !== ecId || vus.has(r.etudiantId)) continue;
    vus.add(r.etudiantId);
    if (r.action === "retrait") resultat.push(r.etudiantId);
  }
  return resultat;
}

export function getPortefeuillePourClasse(classeId: string): PortefeuilleCoursRecord[] {
  return store.records.filter((r) => r.classeId === classeId);
}

export interface NouvelleActionPortefeuilleInput {
  etudiantId: string;
  etudiant: string;
  matricule: string;
  ecId: string;
  ec: string;
}

export function enregistrerActionsPortefeuille(
  entries: NouvelleActionPortefeuilleInput[],
  classeId: string,
  classe: string,
  action: ActionPortefeuille,
  effectuePar: string,
  motif?: string,
): PortefeuilleCoursRecord[] {
  const date = new Date().toISOString().slice(0, 10);
  const nouveaux: PortefeuilleCoursRecord[] = entries.map((e, i) => ({
    id: `pf-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    etudiantId: e.etudiantId,
    etudiant: e.etudiant,
    matricule: e.matricule,
    classeId,
    classe,
    ecId: e.ecId,
    ec: e.ec,
    action,
    dateAction: date,
    effectuePar,
    motif: motif || undefined,
  }));
  store.records = [...nouveaux, ...store.records];
  persist();
  return nouveaux;
}

export function supprimerActionPortefeuille(id: string): void {
  store.records = store.records.filter((r) => r.id !== id);
  persist();
}
