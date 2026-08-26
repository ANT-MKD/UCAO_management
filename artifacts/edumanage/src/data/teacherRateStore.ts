const STORAGE_KEY = "edumanage-teacher-rates-v1";

export type ModePaiementProf = "" | "taux_horaire" | "forfait";

export interface TeacherCourseRateRecord {
  id: string;
  teacherId: string;
  ecId: string;
  classeId: string;
  annee: string;
  modePaiement: ModePaiementProf;
  montant: number | null;
  tauxAbatt: number;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): TeacherCourseRateRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TeacherCourseRateRecord[];
  } catch {
    return [];
  }
}

let store: TeacherCourseRateRecord[] = load();

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeTeacherRates(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTeacherRates(): TeacherCourseRateRecord[] {
  return store;
}

export function getTeacherRate(id: string): TeacherCourseRateRecord | undefined {
  return store.find((r) => r.id === id);
}

export function makeTeacherRateId(
  teacherId: string,
  ecId: string,
  classeId: string,
  annee: string,
): string {
  return `${teacherId}:${annee}:${ecId}:${classeId}`;
}

export function upsertTeacherRate(record: TeacherCourseRateRecord): void {
  const idx = store.findIndex((r) => r.id === record.id);
  if (idx >= 0) store[idx] = record;
  else store.push(record);
  persist();
}

export function upsertTeacherRates(records: TeacherCourseRateRecord[]): void {
  for (const record of records) {
    const idx = store.findIndex((r) => r.id === record.id);
    if (idx >= 0) store[idx] = record;
    else store.push(record);
  }
  persist();
}
