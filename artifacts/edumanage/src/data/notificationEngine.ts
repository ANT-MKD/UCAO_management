import { getNotificationEvenementielleParCode } from "./notificationEvenementielleStore";
import { pushNotificationEtPersister } from "./studentStore";

export interface CiblesNotification {
  etudiantUserId?: string;
  professeurUserId?: string;
  parentUserId?: string;
  tuteurUserId?: string;
}

/** Point d'entrée unique pour toute notification événementielle réelle : vérifie que le code est
 * activé dans le catalogue (Paramétrage communication) puis n'envoie qu'aux destinataires cochés
 * pour ce code — jamais un envoi inconditionnel comme c'était le cas avant (pushNotification()
 * était déjà appelé un peu partout dans studentStore.ts, mais sans aucun interrupteur). Un
 * destinataire (parent/tuteur) coché mais sans compte réel dans l'application (aucun rôle
 * parent/tuteur n'existe pour l'instant) est silencieusement ignoré — honnête plutôt que fabriqué. */
export function declencherNotificationEvenementielle(code: string, message: string, cibles: CiblesNotification): void {
  const config = getNotificationEvenementielleParCode(code);
  if (!config || !config.actif) return;

  if (config.envoyerEtudiant && cibles.etudiantUserId) pushNotificationEtPersister(cibles.etudiantUserId, message);
  if (config.envoyerProfesseur && cibles.professeurUserId) pushNotificationEtPersister(cibles.professeurUserId, message);
  if (config.envoyerParent && cibles.parentUserId) pushNotificationEtPersister(cibles.parentUserId, message);
  if (config.envoyerTuteur && cibles.tuteurUserId) pushNotificationEtPersister(cibles.tuteurUserId, message);
}
