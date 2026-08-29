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
  description?: string;
  creePar?: string;
  dateCreation: string;
  modifiePar?: string;
  modifieLe?: string;
  /** Reprise de l'examen en session de rattrapage : type reste "examen", jamais utilisé pour
   * un devoir. Une entrée normale et sa reprise coexistent, chacune avec ses propres notes. */
  session?: "rattrapage";
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
  excludeId?: string,
): EvaluationRecord[] {
  return store.evaluations.filter(
    (e) =>
      e.classeId === classeId &&
      e.ecId === ecId &&
      e.semestreId === semestreId &&
      e.type === type &&
      e.id !== excludeId,
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
  session?: "rattrapage";
}

export function createEvaluation(payload: EvaluationPayload): EvaluationRecord {
  const filiere = FILIERES.find((f) => f.id === payload.filiereId);
  const classe = getClasseById(payload.classeId);
  const ec = getEcById(payload.ecId);
  const professeur = payload.professeurId
    ? ENSEIGNANTS.find((en) => en.id === payload.professeurId)
    : undefined;

  // Code lisible affiché aux utilisateurs : préfixe 1 pour un devoir, 2 pour un examen normal,
  // 3 pour un rattrapage (repris de l'ancien système), suivi d'un suffixe temporel pour l'unicité.
  const prefixe = payload.session === "rattrapage" ? "3" : payload.type === "devoir" ? "1" : "2";
  const code = `${prefixe}${Date.now().toString().slice(-8)}`;

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
    session: payload.session,
  };

  store.evaluations.push(evaluation);
  persist();
  return evaluation;
}

export interface EvaluationUpdatePayload {
  semestreId: string;
  semestre: string;
  ecId: string;
  type: EvaluationRecord["type"];
  poids: number;
  modifiePar?: string;
  /** Omis = inchangé. Permet à Saisie des Notes de ne corriger que la date ou la description. */
  dateCreation?: string;
  description?: string;
}

export function updateEvaluation(id: string, patch: EvaluationUpdatePayload): EvaluationRecord | undefined {
  const evaluation = store.evaluations.find((e) => e.id === id);
  if (!evaluation) return undefined;
  const ec = getEcById(patch.ecId);
  evaluation.semestreId = patch.semestreId;
  evaluation.semestre = patch.semestre;
  evaluation.ecId = patch.ecId;
  evaluation.cours = ec ? `${ec.code} — ${ec.libelle}` : evaluation.cours;
  evaluation.type = patch.type;
  evaluation.poids = patch.poids;
  if (patch.dateCreation !== undefined) evaluation.dateCreation = patch.dateCreation;
  if (patch.description !== undefined) evaluation.description = patch.description;
  evaluation.modifiePar = patch.modifiePar;
  evaluation.modifieLe = new Date().toISOString().slice(0, 10);
  persist();
  return evaluation;
}

/** Poids de l'autre type (Devoir/Examen) déjà posé pour ce cours/classe/session, si présent. */
export function getPoidsAutreType(
  classeId: string,
  ecId: string,
  semestreId: string,
  type: EvaluationRecord["type"],
  excludeId?: string,
): number | undefined {
  const autreType: EvaluationRecord["type"] = type === "devoir" ? "examen" : "devoir";
  return store.evaluations.find(
    (e) => e.classeId === classeId && e.ecId === ecId && e.semestreId === semestreId && e.type === autreType && e.id !== excludeId,
  )?.poids;
}

/** La session de rattrapage déjà créée pour cet examen, si elle existe. */
export function getRattrapageEvaluation(classeId: string, ecId: string, semestreId: string): EvaluationRecord | undefined {
  return store.evaluations.find(
    (e) => e.classeId === classeId && e.ecId === ecId && e.semestreId === semestreId && e.session === "rattrapage",
  );
}

/** Poids réels (Devoir/Examen) posés pour un cours et une classe, tous semestres confondus
 * (chaque EC n'appartenant qu'à un seul semestre en pratique). Utilisé par Bulletin étudiants
 * pour combiner CC+EF en une moyenne d'EC, avec repli 30/70 par défaut. */
export function getPoidsForClasseEc(classeId: string, ecId: string): { devoir?: number; examen?: number } {
  const devoir = store.evaluations.find((e) => e.classeId === classeId && e.ecId === ecId && e.type === "devoir")?.poids;
  const examen = store.evaluations.find((e) => e.classeId === classeId && e.ecId === ecId && e.type === "examen")?.poids;
  return { devoir, examen };
}
