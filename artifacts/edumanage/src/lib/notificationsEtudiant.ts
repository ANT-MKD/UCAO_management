/** Catégorie d'une notification étudiante, déduite des gabarits réellement envoyés par
 * l'application (studentStore.ts, attestationStore.ts, mailEnvoyeStore.ts, AuthContext.tsx). */
export function categoriserNotificationEtudiant(message: string): string {
  if (/bloqu/i.test(message)) return "compte";
  if (/nouveau document disponible|votre pièce/i.test(message)) return "documents";
  if (/votre demande/i.test(message)) return "demandes";
  if (/nouveau message/i.test(message)) return "messagerie";
  if (/nouvelles? notes? publiées?|relevé de notes/i.test(message)) return "notes";
  if (/nouvelle ressource/i.test(message)) return "academique";
  if (/absence constatée/i.test(message)) return "absences";
  if (/nouveaux? créneaux?|edt mis à jour|^emploi du temps|séance (modifiée|annulée)|cours (modifié|annulé|déplacé)|créneau déplacé/i.test(message)) return "emploi_du_temps";
  if (/paiement validé|quittance|reçu /i.test(message)) return "finances";
  if (/affecté à la classe/i.test(message)) return "academique";
  return "autres";
}

/** Page du portail où l'étudiant trouve ce dont parle la notification — celle qu'un clic ouvre.
 * Aucune pour un message sans page dédiée (blocage de compte, message général). */
export function lienNotificationEtudiant(message: string): string | undefined {
  if (/relevé de notes|bulletin/i.test(message)) return "/student/releves";
  switch (categoriserNotificationEtudiant(message)) {
    case "notes": return "/student/notes";
    case "emploi_du_temps": return "/student/schedule";
    case "absences": return "/student/absences";
    case "demandes": return "/student/requests";
    case "messagerie": return "/student/messages";
    case "documents": return "/student/documents";
    case "finances": return "/student/frais-paye";
    case "academique": return /ressource/i.test(message) ? "/student/ressources" : "/student/cours";
    default: return undefined;
  }
}
