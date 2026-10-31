import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import {
  getAnnuaire,
  getMessages,
  remplacerAnnuaire,
  remplacerMessages,
  type CompteAnnuaire,
  type MessageRecord,
} from "./studentStore";
import { getMailsEnvoyes, remplacerMailsEnvoyes, type MailEnvoyeRecord } from "./mailEnvoyeStore";

/** Communication reflétée dans la base (partie 8).
 *
 * Messages : chacun lit ceux qu'il a envoyés ou reçus ; un message part une fois, daté par la base,
 * qui prévient son destinataire ; seul le destinataire le marque lu. Annuaire : les comptes que ce
 * compte peut nommer (tous pour l'administration), relu quand ses messages ou les comptes changent.
 * Mails envoyés (administration) : la base les valide, les dépose chez leurs destinataires et
 * prévient qui doit l'être. Ce qui arrive d'un autre poste s'affiche en direct. */
enregistrerMiroir({
  cle: "edumanage-app-store-v2",
  parties: [
    partie<MessageRecord>({
      table: "messages",
      colonnes: ["id", ["fromUserId", "expediteur"], ["toUserId", "destinataire"], ["subject", "objet"], ["content", "contenu"], ["createdAt", "cree_le"], ["read", "lu"]],
      lire: getMessages,
      remplacer: remplacerMessages,
    }),
    partie<CompteAnnuaire>({
      table: "comptes",
      rpc: "annuaire",
      lectureSeule: true,
      colonnes: ["id", "typeCompte", "identifiant", "nomAffiche", "fonction", "lienId", "roleId", "actif", "email", "telephone", "doitChangerMotDePasse",
        ["motDePasseChangeLe", "mot_de_passe_change_le"]],
      lire: getAnnuaire,
      remplacer: remplacerAnnuaire,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-mails-envoyes-v1",
  parties: [
    partie<MailEnvoyeRecord>({
      table: "mails_envoyes",
      colonnes: ["id", "auteurId", "auteurLabel", ["date", "cree_le"], "selections", "destinataires", "emailsSupplementaires", "objet", "message",
        "fichiers", "statut", "validateurId", "validateurLabel", "dateTraitement", "motifRejet"],
      lire: getMailsEnvoyes,
      remplacer: remplacerMailsEnvoyes,
    }),
  ],
});
