const STORAGE_KEY = "edumanage-teacher-volumes-v1";

export interface TeacherCourseVolumeRecord {
  id: string;
  teacherId: string;
  ecId: string;
  classeId: string;
  annee: string;
  nouveauVh: number;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): TeacherCourseVolumeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TeacherCourseVolumeRecord[];
  } catch {
    return [];
  }
}

let store: TeacherCourseVolumeRecord[] = load();

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeTeacherVolumes(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTeacherVolumes(): TeacherCourseVolumeRecord[] {
  return store;
}

export function getTeacherVolume(id: string): TeacherCourseVolumeRecord | undefined {
  return store.find((r) => r.id === id);
}

export function makeTeacherVolumeId(
  teacherId: string,
  ecId: string,
  classeId: string,
  annee: string,
): string {
  return `${teacherId}:${annee}:${ecId}:${classeId}`;
}

export function upsertTeacherVolumes(records: TeacherCourseVolumeRecord[]): void {
  for (const record of records) {
    const idx = store.findIndex((r) => r.id === record.id);
    if (idx >= 0) store[idx] = record;
    else store.push(record);
  }
  persist();
}
