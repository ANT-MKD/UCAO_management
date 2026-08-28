import { FILIERES, ENSEIGNANTS } from "./mockData";
import { getEcById } from "./curriculumStore";
import { getClasseById } from "./structureStore";

export interface EvaluationRecord {
  id: string;
  code: string;
  filiereId: string;
  filiere: string;
  annee: string;
  niveauId: string;
  niveau: string;
  classeId: string;
  classe: string;
  semestreId: string;
  semestre: string;
  ecId: string;
  cours: string;
  professeurId?: string;
  professeur: string;
  type: "devoir" | "examen";
  poids: number;
  creePar?: string;
  dateCreation: string;
}

interface EvaluationStore {
  evaluations: EvaluationRecord[];
}

const STORAGE_KEY = "edumanage-evaluation-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeEvaluation(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function buildFresh(): EvaluationStore {
  return { evaluations: [] };
}

function load(): EvaluationStore {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<EvaluationStore>;
        return { evaluations: parsed.evaluations ?? [] };
      } catch {
        /* fallthrough */
      }
    }
  }
  return buildFresh();
}

let store = load();

function persist() {
  store = { evaluations: store.evaluations.slice() };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (err) {
      console.error("[EduManage] evaluation persist failed", err);
    }
  }
  notify();
}

export function getEvaluations(): EvaluationRecord[] {
  return store.evaluations;
}

export function getEvaluationById(id: string): EvaluationRecord | undefined {
  return store.evaluations.find((e) => e.id === id);
}

export function deleteEvaluation(id: string): void {
  store.evaluations = store.evaluations.filter((e) => e.id !== id);
  persist();
}

export function findEvaluationsDoublon(
  classeId: string,
  ecId: string,
  semestreId: string,
  type: EvaluationRecord["type"],
): EvaluationRecord[] {
  return store.evaluations.filter(
    (e) => e.classeId === classeId && e.ecId === ecId && e.semestreId === semestreId && e.type === type,
  );
}

export interface EvaluationPayload {
  filiereId: string;
  annee: string;
  niveauId: string;
  niveau: string;
  classeId: string;
  semestreId: string;
  semestre: string;
  ecId: string;
  professeurId?: string;
  professeur: string;
  type: EvaluationRecord["type"];
  poids: number;
  creePar?: string;
}

export function createEvaluation(payload: EvaluationPayload): EvaluationRecord {
  const filiere = FILIERES.find((f) => f.id === payload.filiereId);
  const classe = getClasseById(payload.classeId);
  const ec = getEcById(payload.ecId);
  const professeur = payload.professeurId
    ? ENSEIGNANTS.find((en) => en.id === payload.professeurId)
    : undefined;

  // Code lisible affiché aux utilisateurs : préfixe 1 pour un devoir, 2 pour un examen
  // (repris de l'ancien système), suivi d'un suffixe temporel pour l'unicité.
  const code = `${payload.type === "devoir" ? "1" : "2"}${Date.now().toString().slice(-8)}`;

  const evaluation: EvaluationRecord = {
    id: `eval-${Date.now()}`,
    code,
    filiereId: payload.filiereId,
    filiere: filiere?.code ?? "",
    annee: payload.annee,
    niveauId: payload.niveauId,
    niveau: payload.niveau,
    classeId: payload.classeId,
    classe: classe?.nom ?? "",
    semestreId: payload.semestreId,
    semestre: payload.semestre,
    ecId: payload.ecId,
    cours: ec ? `${ec.code} — ${ec.libelle}` : "",
    professeurId: payload.professeurId,
    professeur: professeur ? `${professeur.prenom} ${professeur.nom}` : payload.professeur,
    type: payload.type,
    poids: payload.poids,
    creePar: payload.creePar,
    dateCreation: new Date().toISOString().slice(0, 10),
  };

  store.evaluations.push(evaluation);
  persist();
  return evaluation;
}
