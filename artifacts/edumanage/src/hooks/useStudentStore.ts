import { useEffect, useSyncExternalStore } from "react";
import {
  demanderCahiersAnnee,
  demanderNotesAnnees,
  subscribe,
  getEtudiants,
  getEtudiantById,
  getEtudiantByMatricule,
  getInscriptionsByEtudiant,
  getInscriptions,
  getAnneesAcademiques,
  getAnneeActuelle,
  getPaiements,
  getPaiementsByEtudiant,
  getNotes,
  getSeances,
  getReleves,
  getUserAccounts,
  getUserAccountById,
  getStudentRequests,
  getMessages,
  getNotifications,
  getAuditLogs,
  getCahiers,
} from "@/data/studentStore";

export function useStudentStore() {
  return useSyncExternalStore(subscribe, getEtudiants, getEtudiants);
}

export function useEtudiant(id: string) {
  useSyncExternalStore(subscribe, () => getEtudiantById(id), () => getEtudiantById(id));
  return getEtudiantById(id);
}

export function useEtudiantByMatricule(matricule: string) {
  useSyncExternalStore(subscribe, () => getEtudiantByMatricule(matricule), () => getEtudiantByMatricule(matricule));
  return getEtudiantByMatricule(matricule);
}

export function useInscriptions(etudiantId: string) {
  useSyncExternalStore(
    subscribe,
    () => getInscriptionsByEtudiant(etudiantId),
    () => getInscriptionsByEtudiant(etudiantId),
  );
  return getInscriptionsByEtudiant(etudiantId);
}

export function useAllInscriptions() {
  return useSyncExternalStore(subscribe, getInscriptions, getInscriptions);
}

export function useAnneesAcademiques() {
  useSyncExternalStore(subscribe, getAnneesAcademiques, getAnneesAcademiques);
  return getAnneesAcademiques();
}

export function useAnneeActuelle() {
  useSyncExternalStore(subscribe, getAnneeActuelle, getAnneeActuelle);
  return getAnneeActuelle();
}

export function usePaiements() {
  useSyncExternalStore(subscribe, getPaiements, getPaiements);
  return getPaiements();
}

export function usePaiementsByEtudiant(etudiantId: string) {
  useSyncExternalStore(
    subscribe,
    () => getPaiementsByEtudiant(etudiantId),
    () => getPaiementsByEtudiant(etudiantId),
  );
  return getPaiementsByEtudiant(etudiantId);
}

export function useNotes() {
  useSyncExternalStore(subscribe, getNotes, getNotes);
  return getNotes();
}

export function useSeances() {
  useSyncExternalStore(subscribe, getSeances, getSeances);
  return getSeances();
}

export function useReleves() {
  useSyncExternalStore(subscribe, getReleves, getReleves);
  return getReleves();
}

export function useUserAccounts() {
  useSyncExternalStore(subscribe, getUserAccounts, getUserAccounts);
  return getUserAccounts();
}

export function useUserAccount(id: string) {
  useSyncExternalStore(subscribe, () => getUserAccountById(id), () => getUserAccountById(id));
  return getUserAccountById(id);
}

export function useStudentRequests() {
  useSyncExternalStore(subscribe, getStudentRequests, getStudentRequests);
  return getStudentRequests();
}

export function useMessages(userId?: string) {
  const all = useSyncExternalStore(subscribe, getMessages, getMessages);
  return userId ? all.filter((m) => m.toUserId === userId || m.fromUserId === userId) : [];
}

export function useNotifications(userId?: string) {
  const all = useSyncExternalStore(subscribe, getNotifications, getNotifications);
  return userId ? all.filter((n) => n.userId === userId) : [];
}

export function useAuditLogs() {
  useSyncExternalStore(subscribe, getAuditLogs, getAuditLogs);
  return getAuditLogs();
}

export function useCahiers() {
  return useSyncExternalStore(subscribe, getCahiers, getCahiers);
}

/** Avec Supabase, seuls les cahiers de l'année en cours sont chargés à la connexion : ceux d'une
 * année passée (avec leur appel) le sont quand un écran l'affiche. */
export function useCahiersAnnee(annee: string | undefined) {
  useEffect(() => demanderCahiersAnnee(annee), [annee]);
}

/** Avec Supabase, les notes et résultats sont chargés pour l'année en cours et les années des
 * étudiants actuels : ceux d'une année plus ancienne le sont quand un écran l'affiche. */
export function useNotesAnnees(...annees: (string | undefined)[]) {
  const cle = annees.filter(Boolean).join("|");
  useEffect(() => demanderNotesAnnees(cle ? cle.split("|") : []), [cle]);
}
