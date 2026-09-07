import { getTeacherVolume, makeTeacherVolumeId, upsertTeacherVolumes } from "@/data/teacherVolumeStore";
import { getUserAccounts, pushNotificationEtPersister } from "@/data/studentStore";

const STORAGE_KEY = "edumanage-rallonges-v1";

export type RallongeStatut = "soumis" | "valide" | "rejete";
export type RallongeOrigine = "prof" | "admin";

export interface RallongeRecord {
  id: string;
  teacherId: string;
  ecId: string;
  classeId: string;
  annee: string;
  vhActuel: number;
  vhSupplementaire: number;
  motif: string;
  statut: RallongeStatut;
  motifRejet?: string;
  origine: RallongeOrigine;
  createdAt: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): RallongeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RallongeRecord[];
  } catch {
    return [];
  }
}

let store: RallongeRecord[] = load();

function persist() {
  // Nouvelle référence de tableau : useSyncExternalStore compare par
  // Object.is et ne re-rend pas si getRallonges() renvoie la même référence.
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeRallonges(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRallonges(): RallongeRecord[] {
  return store;
}

export function makeRallongeId(): string {
  return `rlg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function addRallonge(
  payload: Omit<RallongeRecord, "id" | "statut" | "createdAt">,
): RallongeRecord {
  const record: RallongeRecord = {
    ...payload,
    id: makeRallongeId(),
    statut: "soumis",
    createdAt: new Date().toISOString(),
  };
  store.push(record);
  persist();
  return record;
}

/**
 * À la validation, la rallonge s'ajoute au V.H courant du cours (issu de
 * teacherVolumeStore s'il a déjà été personnalisé, sinon au V.H constaté au
 * moment de la demande) — comme si l'admin l'avait saisie manuellement dans
 * "Mise à jour V.H".
 */
export function updateRallongeStatut(
  id: string,
  statut: RallongeStatut,
  motifRejet?: string,
): RallongeRecord | undefined {
  const idx = store.findIndex((r) => r.id === id);
  if (idx < 0) return undefined;

  const record: RallongeRecord = {
    ...store[idx],
    statut,
    motifRejet: statut === "rejete" ? motifRejet?.trim() || store[idx].motifRejet : undefined,
  };
  store[idx] = record;

  if (statut === "valide") {
    const volumeId = makeTeacherVolumeId(record.teacherId, record.ecId, record.classeId, record.annee);
    const currentVh = getTeacherVolume(volumeId)?.nouveauVh ?? record.vhActuel;
    upsertTeacherVolumes([
      {
        id: volumeId,
        teacherId: record.teacherId,
        ecId: record.ecId,
        classeId: record.classeId,
        annee: record.annee,
        nouveauVh: currentVh + record.vhSupplementaire,
      },
    ]);
  }

  persist();

  const compte = getUserAccounts().find((u) => u.role === "teacher" && u.linkedId === record.teacherId);
  if (compte) {
    if (statut === "valide") {
      pushNotificationEtPersister(compte.id, `Votre demande de rallonge (+${record.vhSupplementaire}h) a été validée.`);
    } else if (statut === "rejete") {
      pushNotificationEtPersister(compte.id, `Votre demande de rallonge a été rejetée${record.motifRejet ? " — " + record.motifRejet : ""}.`);
    }
  }

  return record;
}
