import { getEtudiantById, getEtudiants, logAudit } from "./studentStore";
import { getRelanceActivePour, relanceEstExpiree } from "./relancePaiementStore";

const STORAGE_KEY = "edumanage-motifs-blocage-v1";

export interface ActionInterdite {
  id: string;
  label: string;
}

/** Reflète des capacités réelles d'EduManage — jamais une action inventée sans effet. "portail
 * parent" et "visioconférences" n'existent pas dans l'appli, donc absents de ce catalogue. */
export const ACTIONS_INTERDITES: ActionInterdite[] = [
  { id: "portail_etudiant", label: "Accès au portail étudiant" },
  { id: "impression_attestation_inscription", label: "Impression attestation d'inscription" },
  { id: "impression_attestation_reussite", label: "Impression attestation de réussite" },
  { id: "impression_certificat_scolarite", label: "Impression du certificat de scolarité" },
  { id: "impression_bulletin", label: "Impression du bulletin / relevé de notes" },
];

export interface MotifBlocageRecord {
  id: string;
  code: string;
  intitule: string;
  actionsInterdites: string[];
  createdAt: string;
}

function load(): MotifBlocageRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MotifBlocageRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let store: MotifBlocageRecord[] = load();

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeMotifsBlocage(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getMotifsBlocage(): MotifBlocageRecord[] {
  return store;
}

export function getMotifBlocageById(id: string): MotifBlocageRecord | undefined {
  return store.find((m) => m.id === id);
}

export interface MotifBlocagePayload {
  code: string;
  intitule: string;
  actionsInterdites: string[];
}

export function upsertMotifBlocage(payload: MotifBlocagePayload, actorId: string, id?: string): MotifBlocageRecord {
  const existing = id ? store.find((m) => m.id === id) : undefined;
  const conflit = store.some((m) => m.code.toLowerCase() === payload.code.trim().toLowerCase() && m.id !== id);
  if (conflit) throw new Error("Ce code de motif est déjà utilisé.");
  if (existing) {
    existing.code = payload.code.trim();
    existing.intitule = payload.intitule.trim();
    existing.actionsInterdites = payload.actionsInterdites;
    persist();
    return existing;
  }
  const motif: MotifBlocageRecord = {
    id: `motif-${Date.now()}`,
    code: payload.code.trim(),
    intitule: payload.intitule.trim(),
    actionsInterdites: payload.actionsInterdites,
    createdAt: new Date().toISOString(),
  };
  store = [motif, ...store];
  logAudit(actorId, "create_motif_blocage", "motif_blocage", motif.id, motif.intitule);
  persist();
  return motif;
}

/** Jamais de suppression d'un motif encore assigné à un étudiant — casserait silencieusement les
 * blocages en cours sans que personne ne s'en aperçoive. */
export function deleteMotifBlocage(id: string): void {
  const enUsage = getEtudiants().some((e) => e.motifBlocageId === id);
  if (enUsage) {
    throw new Error("Ce motif est assigné à au moins un étudiant — retirez le blocage avant de le supprimer.");
  }
  store = store.filter((m) => m.id !== id);
  persist();
}

/** Consultée par AuthContext.login() (accès portail) et par AttestationsPage/RelevesPage (avant
 * impression) — toujours résolue en direct depuis le motif assigné à l'étudiant, jamais un flag
 * dupliqué qui pourrait diverger. */
export function estActionInterdite(etudiantId: string, actionId: string): boolean {
  const etudiant = getEtudiantById(etudiantId);
  if (etudiant?.motifBlocageId) {
    const motif = getMotifBlocageById(etudiant.motifBlocageId);
    if (motif?.actionsInterdites.includes(actionId)) return true;
  }
  // Blocage automatique impayé : une relance de paiement expirée sans régularisation coupe
  // l'accès portail, indépendamment de tout motif de blocage assigné manuellement.
  if (actionId === "portail_etudiant" && etudiant && etudiant.soldeDu > 0) {
    const relance = getRelanceActivePour(etudiantId);
    if (relance && relanceEstExpiree(relance)) return true;
  }
  return false;
}

/** Motif d'affichage (utilisé par le portail de connexion et la fiche étudiant) quand le blocage
 * vient de la relance impayé plutôt que d'un motif assigné manuellement. */
export function motifBlocagePortailPour(etudiantId: string): string | undefined {
  const etudiant = getEtudiantById(etudiantId);
  if (etudiant?.motifBlocageId) {
    const motif = getMotifBlocageById(etudiant.motifBlocageId);
    if (motif?.actionsInterdites.includes("portail_etudiant")) return motif.intitule;
  }
  if (etudiant && etudiant.soldeDu > 0) {
    const relance = getRelanceActivePour(etudiantId);
    if (relance && relanceEstExpiree(relance)) return "Délai de règlement des impayés dépassé";
  }
  return undefined;
}
