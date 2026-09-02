import { VACATIONS } from "./mockData";
import { logAudit } from "./studentStore";

export type VacationStatut = "brouillon" | "valide" | "paye";

export interface VacationRecord {
  id: string;
  mois: string;
  enseignant: string;
  enseignantId: string;
  modules: string[];
  heuresCm: number;
  heuresTd: number;
  tauxHoraire: number;
  montantTotal: number;
  statut: VacationStatut;
  moyen: string;
  observations?: string;
}

const STORAGE_KEY = "edumanage-vacation-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** VACATIONS (data/mockData.ts) est lu directement par VacationsPage — ce store mute donc ce
 * même tableau en place, comme teacherStore.ts/niveauStore.ts. */
const vacations = VACATIONS as unknown as VacationRecord[];

function loadPersisted() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as VacationRecord[];
    vacations.splice(0, vacations.length, ...saved);
  } catch {
    /* conserve le seed en cas d'erreur de lecture */
  }
}

let snapshot: VacationRecord[] = [];

function refreshSnapshot() {
  snapshot = [...vacations];
}

loadPersisted();
refreshSnapshot();

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vacations));
  }
  refreshSnapshot();
  notify();
}

export function subscribeVacations(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getVacations(): VacationRecord[] {
  return snapshot;
}

export function getVacationById(id: string): VacationRecord | undefined {
  return vacations.find((v) => v.id === id);
}

export type VacationInput = Omit<VacationRecord, "id" | "montantTotal" | "enseignant">;

export function addVacation(payload: VacationInput, enseignantNom: string, actorId: string): VacationRecord {
  const montantTotal = (payload.heuresCm + payload.heuresTd) * payload.tauxHoraire;
  const record: VacationRecord = { id: `va-${Date.now()}`, enseignant: enseignantNom, montantTotal, ...payload };
  vacations.push(record);
  logAudit(actorId, "create_vacation", "vacation", record.id, `${enseignantNom} — ${payload.mois}`);
  persist();
  return record;
}

export function updateVacation(id: string, payload: VacationInput, enseignantNom: string, actorId: string) {
  const v = vacations.find((x) => x.id === id);
  if (!v) return;
  const montantTotal = (payload.heuresCm + payload.heuresTd) * payload.tauxHoraire;
  Object.assign(v, payload, { enseignant: enseignantNom, montantTotal });
  logAudit(actorId, "update_vacation", "vacation", id, `${enseignantNom} — ${payload.mois}`);
  persist();
}

export function markVacationPaid(id: string, moyen: string, actorId: string) {
  const v = vacations.find((x) => x.id === id);
  if (!v) return;
  v.statut = "paye";
  v.moyen = moyen;
  logAudit(actorId, "pay_vacation", "vacation", id, `${v.enseignant} — ${v.mois} — ${moyen}`);
  persist();
}
