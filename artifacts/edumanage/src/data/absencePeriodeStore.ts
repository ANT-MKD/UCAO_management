const STORAGE_KEY = "edumanage-absence-periode-v1";

/** Absence déclarée sur une plage de dates (maladie, sortie scolaire, congé autorisé) plutôt
 * que pour une séance précise — contrairement à l'assiduité par séance (Cahier de textes), qui
 * reste la seule source pour "était-il en cours ce jour-là". Une déclaration de période sert à
 * justifier par avance ce que le cahier de textes constatera séance par séance. */
export interface AbsencePeriodeRecord {
  id: string;
  etudiantId: string;
  etudiant: string;
  matricule: string;
  classeId: string;
  classe: string;
  filiereId: string;
  filiere: string;
  niveau: string;
  annee: string;
  dateDebut: string;
  dateFin: string;
  motif: string;
  justifie: boolean;
  justificatif?: string;
  declarePar: string;
  dateDeclaration: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeAbsencesPeriode(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

interface Persisted {
  records: AbsencePeriodeRecord[];
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

export function getAbsencesPeriode(): AbsencePeriodeRecord[] {
  return store.records;
}

/** Déclaration de période qui couvre une date donnée pour un étudiant — utilisée par Les
 * assiduités pour justifier automatiquement une absence déjà constatée par un cahier de textes
 * sur ces dates, sans qu'un admin ait à le refaire séance par séance. */
export function getAbsencePeriodeCouvrant(etudiantId: string, date: string): AbsencePeriodeRecord | undefined {
  return store.records.find((r) => r.etudiantId === etudiantId && date >= r.dateDebut && date <= r.dateFin);
}

export interface NouvelleAbsencePeriodeEtudiant {
  etudiantId: string;
  etudiant: string;
  matricule: string;
  justifie: boolean;
  justificatif?: string;
}

export interface NouvelleAbsencePeriodeInput {
  etudiants: NouvelleAbsencePeriodeEtudiant[];
  classeId: string;
  classe: string;
  filiereId: string;
  filiere: string;
  niveau: string;
  annee: string;
  dateDebut: string;
  dateFin: string;
  motif: string;
  declarePar: string;
}

export function declarerAbsencesPeriode(input: NouvelleAbsencePeriodeInput): AbsencePeriodeRecord[] {
  const date = new Date().toISOString().slice(0, 10);
  const nouveaux: AbsencePeriodeRecord[] = input.etudiants.map((e, i) => ({
    id: `absp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    etudiantId: e.etudiantId,
    etudiant: e.etudiant,
    matricule: e.matricule,
    classeId: input.classeId,
    classe: input.classe,
    filiereId: input.filiereId,
    filiere: input.filiere,
    niveau: input.niveau,
    annee: input.annee,
    dateDebut: input.dateDebut,
    dateFin: input.dateFin,
    motif: input.motif,
    justifie: e.justifie,
    justificatif: e.justificatif,
    declarePar: input.declarePar,
    dateDeclaration: date,
  }));
  store.records = [...nouveaux, ...store.records];
  persist();
  return nouveaux;
}

export function marquerJustifieAbsencePeriode(id: string, justifie: boolean, justificatif?: string): void {
  const idx = store.records.findIndex((r) => r.id === id);
  if (idx === -1) return;
  store.records = store.records.map((r, i) => (i === idx ? { ...r, justifie, justificatif } : r));
  persist();
}
