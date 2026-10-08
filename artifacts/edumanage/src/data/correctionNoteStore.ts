import { ecrireStockage } from "@/lib/stockageLocal";
import {
  corrigerNoteOfficielle, getNotes, getUserAccounts, logAudit, noteEstOfficielle, pushNotificationEtPersister,
} from "@/data/studentStore";
import { getEvaluations } from "@/data/evaluationStore";
import { getDeliberationForClasseSemestre } from "@/data/deliberationStore";

/** Demande de correction d'une note officielle (validée ou publiée) : le professeur ne modifie
 * plus une telle note lui-même ; il propose la nouvelle valeur avec un motif, et la scolarité
 * accepte (la note est corrigée et la correction inscrite au journal) ou refuse en motivant. */
const STORAGE_KEY = "edumanage-corrections-notes-v1";

export type StatutCorrectionNote = "en_attente" | "acceptee" | "refusee";

export interface DemandeCorrectionNoteRecord {
  id: string;
  noteId: string;
  etudiantId: string;
  etudiant: string;
  matricule: string;
  ecId: string;
  ec: string;
  classeId: string;
  /** « Examen », « Contrôle continu »… */
  typeLabel: string;
  ancienneNote: number;
  ancienAbsent?: boolean;
  nouvelleNote: number;
  nouvelAbsent?: boolean;
  motif: string;
  demandeParId: string;
  demandePar: string;
  statut: StatutCorrectionNote;
  motifRefus?: string;
  createdAt: string;
  traiteeLe?: string;
  traiteePar?: string;
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): DemandeCorrectionNoteRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemandeCorrectionNoteRecord[]) : [];
  } catch {
    return [];
  }
}

let store: DemandeCorrectionNoteRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") ecrireStockage(STORAGE_KEY, JSON.stringify(store));
  notify();
}

export function subscribeDemandesCorrection(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDemandesCorrection(): DemandeCorrectionNoteRecord[] {
  return store;
}

export function libelleValeurNote(note: number, absent?: boolean): string {
  return absent ? "ABS" : note.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface DemanderCorrectionPayload {
  noteId: string;
  nouvelleNote: number;
  absent?: boolean;
  motif: string;
  bareme?: number;
}

export function demanderCorrectionNote(payload: DemanderCorrectionPayload, actorUserId: string): DemandeCorrectionNoteRecord {
  const note = getNotes().find((n) => n.id === payload.noteId);
  if (!note) throw new Error("Note introuvable.");
  if (!noteEstOfficielle(note)) throw new Error("Cette note n'est pas encore validée : modifiez-la directement dans la saisie.");
  const motif = payload.motif.trim();
  if (!motif) throw new Error("Indiquez le motif de la correction : la scolarité en a besoin pour décider.");
  const bareme = payload.bareme ?? 20;
  if (!payload.absent && (Number.isNaN(payload.nouvelleNote) || payload.nouvelleNote < 0 || payload.nouvelleNote > bareme)) {
    throw new Error(`La nouvelle note doit être comprise entre 0 et ${bareme}.`);
  }
  if (!!payload.absent === !!note.absent && (payload.absent || payload.nouvelleNote === note.note)) {
    throw new Error("La nouvelle note est identique à la note actuelle.");
  }
  if (store.some((d) => d.noteId === note.id && d.statut === "en_attente")) {
    throw new Error("Une demande de correction est déjà en attente pour cette note.");
  }
  const auteur = getUserAccounts().find((u) => u.id === actorUserId);
  const record: DemandeCorrectionNoteRecord = {
    id: `cor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    noteId: note.id,
    etudiantId: note.etudiantId,
    etudiant: note.etudiant,
    matricule: note.matricule,
    ecId: note.ecId,
    ec: note.ec,
    classeId: note.classeId,
    typeLabel: note.type === "EF" ? "Examen" : note.type === "CC" ? "Contrôle continu" : note.type,
    ancienneNote: note.note,
    ancienAbsent: note.absent,
    nouvelleNote: payload.absent ? 0 : payload.nouvelleNote,
    nouvelAbsent: payload.absent ? true : undefined,
    motif,
    demandeParId: actorUserId,
    demandePar: auteur?.displayName ?? "Professeur",
    statut: "en_attente",
    createdAt: new Date().toISOString(),
  };
  store = [record, ...store];
  persist();
  logAudit(actorUserId, "demande_correction_note", "note", note.id, `${note.etudiant} — ${note.ec} : ${libelleValeurNote(note.note, note.absent)} → ${libelleValeurNote(record.nouvelleNote, record.nouvelAbsent)} — motif : ${motif}`);
  for (const admin of getUserAccounts().filter((u) => u.role === "admin" && u.actif !== false)) {
    pushNotificationEtPersister(admin.id, `Correction de note demandée par ${record.demandePar} : ${note.etudiant} — ${note.ec} (${record.typeLabel}) ${libelleValeurNote(note.note, note.absent)} → ${libelleValeurNote(record.nouvelleNote, record.nouvelAbsent)}.`);
  }
  return record;
}

/** Décision de la scolarité. Acceptée : la note est corrigée (corrigerNoteOfficielle, journal et
 * étudiant prévenu) — sauf si le jury du semestre est clôturé, qu'il faut alors rouvrir. */
export function traiterDemandeCorrection(id: string, decision: "accepter" | "refuser", actorUserId: string, motifRefus?: string): DemandeCorrectionNoteRecord {
  const demande = store.find((d) => d.id === id);
  if (!demande || demande.statut !== "en_attente") throw new Error("Cette demande a déjà été traitée.");
  const auteur = getUserAccounts().find((u) => u.id === actorUserId);
  if (decision === "refuser") {
    if (!motifRefus?.trim()) throw new Error("Indiquez le motif du refus : le professeur le verra.");
    demande.statut = "refusee";
    demande.motifRefus = motifRefus.trim();
  } else {
    const note = getNotes().find((n) => n.id === demande.noteId);
    if (!note) throw new Error("La note concernée n'existe plus.");
    const evaluation = getEvaluations().find((e) => e.id === (note.evaluationId ?? ""));
    const deliberation = evaluation ? getDeliberationForClasseSemestre(note.classeId, evaluation.semestreId) : undefined;
    if (deliberation?.statut === "cloturee") {
      throw new Error("Le jury de ce semestre est clôturé : rouvrez la délibération avant de corriger la note.");
    }
    corrigerNoteOfficielle(note.id, demande.nouvelleNote, !!demande.nouvelAbsent, actorUserId, `${demande.motif} (demande de ${demande.demandePar})`);
    demande.statut = "acceptee";
  }
  demande.traiteeLe = new Date().toISOString();
  demande.traiteePar = auteur?.displayName ?? "Administration";
  persist();
  const avantApres = `${libelleValeurNote(demande.ancienneNote, demande.ancienAbsent)} → ${libelleValeurNote(demande.nouvelleNote, demande.nouvelAbsent)}`;
  pushNotificationEtPersister(
    demande.demandeParId,
    decision === "accepter"
      ? `Votre demande de correction a été acceptée : ${demande.etudiant} — ${demande.ec} (${demande.typeLabel}) ${avantApres}.`
      : `Votre demande de correction a été refusée : ${demande.etudiant} — ${demande.ec} (${demande.typeLabel}) — motif : ${demande.motifRefus}.`,
  );
  return demande;
}
