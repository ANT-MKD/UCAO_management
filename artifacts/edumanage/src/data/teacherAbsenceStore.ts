import { ecrireStockage } from "@/lib/stockageLocal";
import { getUserAccounts, logAudit, pushNotificationEtPersister } from "./studentStore";
import { getEcs } from "./curriculumStore";
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
  /** Justificatif envoyé par le professeur depuis « Mes absences », en attente de décision. */
  justificatif?: { motif: string; pieceJointe?: { nom: string; dataUrl: string }; envoyeLe: string };
  /** Dernier justificatif refusé par l'administration, avec son motif (le professeur peut en renvoyer un). */
  justificatifRefuse?: { motif: string; motifRefus: string; refuseLe: string };
}

export type StatutJustificationAbsence = "justifiee" | "justificatif_envoye" | "justificatif_refuse" | "non_justifiee";

export function statutJustificationAbsence(a: Pick<TeacherAbsenceRecord, "justifie" | "justificatif" | "justificatifRefuse">): StatutJustificationAbsence {
  if (a.justifie) return "justifiee";
  if (a.justificatif) return "justificatif_envoye";
  if (a.justificatifRefuse) return "justificatif_refuse";
  return "non_justifiee";
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
    ecrireStockage(STORAGE_KEY, JSON.stringify(store));
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
  // Le professeur est informé du constat dès sa saisie (et non plus seulement à sa validation).
  const compte = getUserAccounts().find((u) => u.role === "teacher" && u.linkedId === record.teacherId);
  if (compte) {
    const ec = getEcs().find((e) => e.id === record.ecId);
    const quoi = record.type === "retard" ? `Un retard${record.dureeMinutes ? ` de ${record.dureeMinutes} min` : ""} a été constaté` : "Une absence a été constatée";
    const date = record.date.slice(0, 10).split("-").reverse().join("/");
    pushNotificationEtPersister(compte.id, `${quoi} le ${date}${ec ? ` en ${ec.libelle}` : ""}${record.motif.trim() ? ` — motif : ${record.motif.trim()}` : ""}. Consultez « Mes absences ».`);
  }
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

const dateFr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Le professeur justifie une absence ou un retard constaté : l'administration est prévenue et
 * décide (deciderJustificatifAbsence). Une seule justification en attente à la fois. */
export function envoyerJustificatifAbsence(
  id: string,
  payload: { motif: string; pieceJointe?: { nom: string; dataUrl: string } },
  actorUserId: string,
): TeacherAbsenceRecord {
  const absence = store.find((r) => r.id === id);
  if (!absence) throw new Error("Constat introuvable.");
  if (absence.justifie) throw new Error("Ce constat est déjà justifié.");
  if (absence.justificatif) throw new Error("Un justificatif est déjà en attente de décision pour ce constat.");
  const motif = payload.motif.trim();
  if (!motif) throw new Error("Expliquez la raison de l'absence ou du retard.");
  const quoi = absence.type === "retard" ? "retard" : "absence";
  const record: TeacherAbsenceRecord = {
    ...absence,
    justificatif: { motif, pieceJointe: payload.pieceJointe, envoyeLe: new Date().toISOString() },
  };
  store = store.map((r) => (r.id === id ? record : r));
  persist();
  logAudit(actorUserId, "justificatif_absence_prof", "teacher_absence", id, `${quoi} du ${dateFr(absence.date)} — ${motif}`);
  const auteur = getUserAccounts().find((u) => u.id === actorUserId);
  for (const admin of getUserAccounts().filter((u) => u.role === "admin" && u.actif !== false)) {
    pushNotificationEtPersister(admin.id, `Justificatif reçu de ${auteur?.displayName ?? "un professeur"} pour son ${quoi} du ${dateFr(absence.date)} : ${motif}.`);
  }
  return record;
}

/** Décision de l'administration sur un justificatif envoyé : accepté, le constat devient justifié ;
 * refusé, le motif est conservé et montré au professeur, qui peut en renvoyer un. */
export function deciderJustificatifAbsence(id: string, decision: "accepter" | "refuser", actorUserId: string, motifRefus?: string): TeacherAbsenceRecord {
  const absence = store.find((r) => r.id === id);
  if (!absence?.justificatif) throw new Error("Aucun justificatif en attente pour ce constat.");
  const quoi = absence.type === "retard" ? "retard" : "absence";
  let record: TeacherAbsenceRecord;
  if (decision === "accepter") {
    record = { ...absence, justifie: true, justificatifRefuse: undefined };
  } else {
    if (!motifRefus?.trim()) throw new Error("Indiquez le motif du refus : le professeur le verra.");
    record = {
      ...absence,
      justificatif: undefined,
      justificatifRefuse: { motif: absence.justificatif.motif, motifRefus: motifRefus.trim(), refuseLe: new Date().toISOString() },
    };
  }
  store = store.map((r) => (r.id === id ? record : r));
  persist();
  logAudit(actorUserId, decision === "accepter" ? "accepter_justificatif_prof" : "refuser_justificatif_prof", "teacher_absence", id, `${quoi} du ${dateFr(absence.date)}${motifRefus ? ` — motif : ${motifRefus}` : ""}`);
  const compte = getUserAccounts().find((u) => u.role === "teacher" && u.linkedId === absence.teacherId);
  if (compte) {
    pushNotificationEtPersister(compte.id, decision === "accepter"
      ? `Justificatif accepté : votre ${quoi} du ${dateFr(absence.date)} est justifié(e).`
      : `Justificatif refusé pour votre ${quoi} du ${dateFr(absence.date)} — motif : ${motifRefus?.trim()}. Vous pouvez en envoyer un autre depuis « Mes absences ».`);
  }
  return record;
}
