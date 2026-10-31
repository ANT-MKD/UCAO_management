import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import { estNotificationDeLaBase, getNotifications, remplacerNotifications, type NotificationRecord } from "./studentStore";

/** Notifications du compte connecté, écrites par la base (emploi du temps depuis la partie 5 ; les
 * autres familles la rejoignent au fil des parties). Lues à la connexion puis à chaque
 * renouvellement de session (toutes les heures) ; l'application n'y renvoie que « lue » et
 * « rangée ». Celles que l'application crée encore sur ce poste n'en partent pas. */
enregistrerMiroir({
  cle: "edumanage-app-store-v2",
  parties: [
    partie<NotificationRecord>({
      table: "notifications",
      colonnes: ["id", ["userId", "destinataire"], "message", ["createdAt", "cree_le"], ["read", "lue"], ["readAt", "lue_le"], ["archived", "archivee"], "groupe", "nombre"],
      miseAJourSeule: true,
      champsModifiables: ["read", "archived"],
      envoyable: estNotificationDeLaBase,
      lire: getNotifications,
      remplacer: remplacerNotifications,
    }),
  ],
});
