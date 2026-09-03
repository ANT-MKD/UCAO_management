import { ENSEIGNANTS } from "./mockData";
import { logAudit } from "./studentStore";

export interface TeacherRecord {
  id: string;
  prenom: string;
  nom: string;
  matricule: string;
  telephone: string;
  specialite: string;
  grade: "Permanent" | "Vacataire" | "Contractuel";
  tauxHoraire: number;
  modulesAssignes: number;
  heuresMois: number;
  email?: string;
  sexe?: "M" | "F";
  dateNaissance?: string;
  paysNaissance?: string;
  lieuNaissance?: string;
  nationalite?: string;
  cni?: string;
  adresse?: string;
  niveauEtude?: string;
  rib?: string;
  diplomes?: string[];
  specialites?: string[];
  photoDataUrl?: string;
}

const STORAGE_KEY = "edumanage-teacher-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** ENSEIGNANTS (data/mockData.ts) est importé et lu directement par une trentaine d'autres
 * fichiers (contrats, vacations, pointage, emploi du temps, poids d'évaluation...). Ce store
 * mute donc ce même tableau en place, comme niveauStore.ts/filiereStore.ts, pour que ces
 * lectures existantes restent à jour sans devoir être réécrites. Seul getTeachers() (usage
 * réactif) renvoie un instantané. */
const teachers = ENSEIGNANTS as unknown as TeacherRecord[];

function loadPersisted() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as TeacherRecord[];
    teachers.splice(0, teachers.length, ...saved);
  } catch {
    /* conserve le seed en cas d'erreur de lecture */
  }
}

let snapshot: TeacherRecord[] = [];

function refreshSnapshot() {
  snapshot = [...teachers];
}

loadPersisted();
refreshSnapshot();

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teachers));
  }
  refreshSnapshot();
  notify();
}

export function subscribeTeachers(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTeachers(): TeacherRecord[] {
  return snapshot;
}

export function getTeacherById(id: string): TeacherRecord | undefined {
  return teachers.find((t) => t.id === id);
}

export type TeacherInput = Omit<TeacherRecord, "id" | "modulesAssignes" | "heuresMois">;

export function addTeacher(payload: TeacherInput, actorId: string): TeacherRecord {
  const record: TeacherRecord = { id: `en-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, modulesAssignes: 0, heuresMois: 0, ...payload };
  teachers.push(record);
  logAudit(actorId, "create_teacher", "teacher", record.id, `${record.prenom} ${record.nom}`);
  persist();
  return record;
}

export function updateTeacher(id: string, patch: Partial<TeacherInput>, actorId: string) {
  const t = teachers.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, patch);
  logAudit(actorId, "update_teacher", "teacher", id, `${t.prenom} ${t.nom}`);
  persist();
}
