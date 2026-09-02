import { getEtudiantById, getUserAccounts, logAudit } from "./studentStore";
import { envoyerMailSysteme } from "./mailEnvoyeStore";

export type RelanceStatut = "active" | "resolue" | "annulee";

export interface RelanceRecord {
  id: string;
  etudiantId: string;
  dateEnvoi: string;
  dateEcheance: string;
  montantDu: number;
  envoyePar: string;
  statut: RelanceStatut;
}

const STORAGE_KEY = "edumanage-relance-paiement-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function load(): RelanceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RelanceRecord[];
  } catch {
    return [];
  }
}

let store: RelanceRecord[] = load();

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeRelances(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRelances(): RelanceRecord[] {
  return store;
}

export function getRelanceActivePour(etudiantId: string): RelanceRecord | undefined {
  return store.find((r) => r.etudiantId === etudiantId && r.statut === "active");
}

/** Une relance active est considérée expirée dès que la date d'échéance est dépassée — évalué en
 * direct à chaque appel (pas de cron), jamais figé au moment de l'envoi. */
export function relanceEstExpiree(relance: RelanceRecord): boolean {
  return new Date().toISOString().slice(0, 10) > relance.dateEcheance;
}

/** Envoie une relance réelle (mail système) à un étudiant en impayé, avec un délai avant blocage
 * automatique du portail. Une seule relance active à la fois par étudiant — en renvoyer une
 * remplace/rafraîchit l'échéance de la précédente plutôt que d'en empiler une nouvelle. */
export function envoyerRelancePaiement(etudiantId: string, delaiJours: number, actorId: string): RelanceRecord | null {
  const etudiant = getEtudiantById(etudiantId);
  if (!etudiant || etudiant.soldeDu <= 0) return null;
  const compteEtudiant = getUserAccounts().find((u) => u.linkedId === etudiantId && u.role === "student");
  if (!compteEtudiant) return null;

  const now = new Date();
  const echeance = new Date(now);
  echeance.setDate(echeance.getDate() + delaiJours);
  const dateEcheance = echeance.toISOString().slice(0, 10);

  store = store.map((r) => (r.etudiantId === etudiantId && r.statut === "active" ? { ...r, statut: "annulee" as const } : r));
  const record: RelanceRecord = {
    id: `relance-${Date.now()}`,
    etudiantId,
    dateEnvoi: now.toISOString().slice(0, 10),
    dateEcheance,
    montantDu: etudiant.soldeDu,
    envoyePar: actorId,
    statut: "active",
  };
  store.push(record);

  envoyerMailSysteme({
    destinataireUserId: compteEtudiant.id,
    destinataireLabel: `${etudiant.prenom} ${etudiant.nom}`,
    destinataireEmail: compteEtudiant.email,
    objet: "Rappel de paiement — régularisation avant blocage de votre accès",
    message: `Bonjour ${etudiant.prenom},\n\nVotre dossier présente un solde impayé de ${etudiant.soldeDu.toLocaleString("fr-FR")} FCFA. Merci de régulariser votre situation avant le ${dateEcheance}, faute de quoi l'accès à votre portail étudiant sera automatiquement suspendu.\n\nL'administration.`,
  });

  logAudit(actorId, "relance_paiement", "etudiant", etudiantId, `Échéance ${dateEcheance} — ${etudiant.soldeDu} FCFA`);
  persist();
  return record;
}

export function annulerRelance(id: string, actorId: string): void {
  const relance = store.find((r) => r.id === id);
  if (!relance) return;
  store = store.map((r) => (r.id === id ? { ...r, statut: "annulee" as const } : r));
  logAudit(actorId, "annuler_relance_paiement", "etudiant", relance.etudiantId);
  persist();
}

/** Une relance "active" se résout d'elle-même dès que l'étudiant n'a plus d'impayé — jamais un
 * flag écrit en base, toujours réévalué en direct (comme relanceEstExpiree), pour ne pas avoir à
 * intercepter chaque point d'entrée de paiement (AddPaiementPage, réinscription, quittance...). */
export function relanceEstResolue(relance: RelanceRecord): boolean {
  const etudiant = getEtudiantById(relance.etudiantId);
  return !etudiant || etudiant.soldeDu <= 0;
}
