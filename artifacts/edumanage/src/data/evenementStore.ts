import { getSeances } from "./studentStore";
import { dateToJour, mondayOf } from "@/lib/teacherUtils";
import { detectEvenementConflicts, type ScheduleConflict } from "@/lib/scheduleUtils";

/** Évènement ponctuel (date précise, ne se répète pas) — distinct d'une séance (créneau
 * hebdomadaire récurrent propre à une semaine). Peut concerner une classe et/ou une salle,
 * jamais un professeur (pas un cours) ; un examen peut nécessiter un surveillant. */
export interface EvenementRecord {
  id: string;
  objet: string;
  date: string;
  typeId: string;
  type: string;
  classeId?: string;
  classe?: string;
  salleId?: string;
  salle?: string;
  heureDebut: string;
  heureFin: string;
  surveillant?: string;
  remarque?: string;
  createdAt: string;
}

const STORAGE_KEY = "edumanage-evenements-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): EvenementRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EvenementRecord[]) : [];
  } catch {
    return [];
  }
}

let evenements: EvenementRecord[] = load();

function persist() {
  evenements = evenements.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(evenements));
  }
  notify();
}

export function subscribeEvenements(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getEvenements(): EvenementRecord[] {
  return evenements;
}

export interface NewEvenementPayload {
  objet: string;
  date: string;
  typeId: string;
  type: string;
  classeId?: string;
  classe?: string;
  salleId?: string;
  salle?: string;
  heureDebut: string;
  heureFin: string;
  surveillant?: string;
  remarque?: string;
}

export function ajouterEvenement(payload: NewEvenementPayload): { evenement?: EvenementRecord; conflicts: ScheduleConflict[] } {
  const jour = dateToJour(payload.date);
  const semaineDu = mondayOf(payload.date);
  const candidate = { id: `ev-${Date.now()}`, date: payload.date, heureDebut: payload.heureDebut, heureFin: payload.heureFin, salleId: payload.salleId };
  const conflicts = detectEvenementConflicts(getSeances(), evenements, candidate, jour, semaineDu);
  if (conflicts.length > 0) return { conflicts };

  const evenement: EvenementRecord = {
    ...payload,
    id: candidate.id,
    createdAt: new Date().toISOString(),
  };
  evenements.push(evenement);
  persist();
  return { evenement, conflicts: [] };
}

export function modifierEvenement(id: string, payload: NewEvenementPayload): { evenement?: EvenementRecord; conflicts: ScheduleConflict[] } {
  const existing = evenements.find((e) => e.id === id);
  if (!existing) return { conflicts: [] };
  const jour = dateToJour(payload.date);
  const semaineDu = mondayOf(payload.date);
  const candidate = { id, date: payload.date, heureDebut: payload.heureDebut, heureFin: payload.heureFin, salleId: payload.salleId };
  const conflicts = detectEvenementConflicts(getSeances(), evenements, candidate, jour, semaineDu);
  if (conflicts.length > 0) return { conflicts };

  const evenement: EvenementRecord = { ...existing, ...payload };
  evenements = evenements.map((e) => (e.id === id ? evenement : e));
  persist();
  return { evenement, conflicts: [] };
}

export function supprimerEvenement(id: string) {
  evenements = evenements.filter((e) => e.id !== id);
  persist();
}
