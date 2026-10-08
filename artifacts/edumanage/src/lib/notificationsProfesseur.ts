/** Page du portail professeur où se trouve ce dont parle une notification — celle qu'un clic
 * ouvre. L'ordre compte : « Votre demande de correction… » parle de notes, pas de demandes. */
export function lienNotificationProfesseur(message: string): string | undefined {
  if (/correction/i.test(message)) return "/teacher/grades";
  if (/rallonge/i.test(message)) return "/teacher/rallonge";
  if (/décompte|vacation|paiement/i.test(message)) return "/teacher/remuneration";
  if (/contrat|avenant|résili/i.test(message)) return "/teacher/contract";
  if (/pointage/i.test(message)) return "/teacher/pointage";
  if (/cahier/i.test(message)) return "/teacher/cahier";
  if (/justificatif|absence|retard/i.test(message)) return "/teacher/absences";
  if (/nouveaux? créneaux?|emploi du temps|séance (modifiée|annulée)|cours (modifié|annulé|déplacé)|créneau déplacé/i.test(message)) return "/teacher/schedule";
  if (/nouveau message/i.test(message)) return "/teacher/messages";
  return undefined;
}
