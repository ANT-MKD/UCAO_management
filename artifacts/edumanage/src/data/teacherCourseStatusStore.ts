const STORAGE_KEY = "edumanage-teacher-course-status-v1";

export type TypeComptabilisation = "" | "normal" | "a_terme";

export interface TeacherCourseStatusRecord {
  id: string;
  teacherId: string;
  ecId: string;
  classeId: string;
  annee: string;
  typeComptabilisation: TypeComptabilisation;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): TeacherCourseStatusRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TeacherCourseStatusRecord[];
  } catch {
    return [];
  }
}

let store: TeacherCourseStatusRecord[] = load();

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeTeacherCourseStatus(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTeacherCourseStatuses(): TeacherCourseStatusRecord[] {
  return store;
}

export function getTeacherCourseStatus(id: string): TeacherCourseStatusRecord | undefined {
  return store.find((r) => r.id === id);
}

export function makeTeacherCourseStatusId(
  teacherId: string,
  ecId: string,
  classeId: string,
  annee: string,
): string {
  return `${teacherId}:${annee}:${ecId}:${classeId}`;
}

export function upsertTeacherCourseStatuses(records: TeacherCourseStatusRecord[]): void {
  for (const record of records) {
    const idx = store.findIndex((r) => r.id === record.id);
    if (idx >= 0) store[idx] = record;
    else store.push(record);
  }
  persist();
}
