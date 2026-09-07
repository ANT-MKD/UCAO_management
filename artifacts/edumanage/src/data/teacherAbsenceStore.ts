const STORAGE_KEY = "edumanage-teacher-absences-v1";

export type TeacherAbsenceType = "absence" | "retard";

export interface TeacherAbsenceRecord {
  id: string;
  teacherId: string;
  ecId: string;
  classeId: string;
  annee: string;
  seanceId?: string;
  date: string;
  type: TeacherAbsenceType;
  dureeMinutes?: number;
  motif: string;
  justifie: boolean;
  createdBy: string;
  createdAt: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): TeacherAbsenceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TeacherAbsenceRecord[];
  } catch {
    return [];
  }
}

let store: TeacherAbsenceRecord[] = load();

function persist() {
  // Nouvelle référence de tableau : useSyncExternalStore compare par
  // Object.is et ne re-rend pas si getTeacherAbsences() renvoie la même référence.
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeTeacherAbsences(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTeacherAbsences(): TeacherAbsenceRecord[] {
  return store;
}

export function makeTeacherAbsenceId(): string {
  return `abs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function addTeacherAbsence(
  payload: Omit<TeacherAbsenceRecord, "id" | "createdAt">,
): TeacherAbsenceRecord {
  const record: TeacherAbsenceRecord = {
    ...payload,
    id: makeTeacherAbsenceId(),
    createdAt: new Date().toISOString(),
  };
  store.push(record);
  persist();
  return record;
}

export function updateTeacherAbsence(
  id: string,
  patch: Partial<Omit<TeacherAbsenceRecord, "id" | "createdAt">>,
): TeacherAbsenceRecord | undefined {
  const idx = store.findIndex((r) => r.id === id);
  if (idx < 0) return undefined;
  store[idx] = { ...store[idx], ...patch };
  persist();
  return store[idx];
}

export function deleteTeacherAbsence(id: string): void {
  store = store.filter((r) => r.id !== id);
  persist();
}
