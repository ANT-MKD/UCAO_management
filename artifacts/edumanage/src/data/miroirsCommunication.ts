import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import {
  getAnnuaire,
  getDemandesLignes,
  getMessages,
  remplacerAnnuaire,
  remplacerDemandes,
  remplacerMessages,
  type CompteAnnuaire,
  type DemandeLigne,
  type MessageRecord,
} from "./studentStore";
import { getMailsEnvoyes, remplacerMailsEnvoyes, type MailEnvoyeRecord } from "./mailEnvoyeStore";
import { getPublicites, remplacerPublicites, type PubliciteRecord } from "./publiciteStore";
import { getRessourcesPedagogiques, remplacerRessourcesPedagogiques, type RessourcePedagogiqueRecord } from "./ressourcePedagogiqueStore";

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

/** Demandes des étudiants : l'étudiant dépose (pièce jointe dans l'espace « demandes ») et annule
 * tant que rien n'est pris en charge ; la page « Demandes » traite, une fois. La base prévient le
 * secrétariat puis l'étudiant, et diffuse en direct. */
enregistrerMiroir({
  cle: "edumanage-app-store-v2",
  parties: [
    partie<DemandeLigne>({
      table: "demandes_etudiants",
      colonnes: ["id", ["studentId", "etudiant_id"], "type", ["subject", "objet"], "message", ["status", "statut"], ["createdAt", "cree_le"],
        ["updatedAt", "modifie_le"], ["handledBy", "traite_par"], "resolution", "porteeRallonge", "dateFinSouhaitee", "absenceCahierId", "absenceLibelle",
        "noteId", "noteLibelle", "attestationType", "attestationId", "attestationNumero", "pieceNom", "pieceType", ["piece", "piece_chemin"]],
      fichiers: { piece: { espace: "demandes", dossier: (d) => `${d.studentId}/${d.id}/` } },
      lire: getDemandesLignes,
      remplacer: remplacerDemandes,
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

/** Actualités des bannières : rédigées par la page « Publicité et actualité », l'image dans l'espace
 * « actualites » ; la base inscrit l'auteur et ne donne à chaque portail que les siennes. */
enregistrerMiroir({
  cle: "edumanage-publicites-v1",
  parties: [
    partie<PubliciteRecord>({
      table: "actualites",
      colonnes: ["id", "typeContenu", "profilCible", "titre", "description", "ordre", "dateDebut", "dateFin", ["imageDataUrl", "image_chemin"], "lienExterne",
        "auteurId", "auteurLabel", ["createdAt", "cree_le"]],
      fichiers: { imageDataUrl: { espace: "actualites", dossier: (p) => `${p.id}/` } },
      lire: getPublicites,
      remplacer: remplacerPublicites,
    }),
  ],
});

/** Ressources pédagogiques : déposées par le professeur pour ses classes (fichier dans l'espace
 * « ressources », ou lien), retirées par leur auteur ; jamais réécrites. La base prévient les
 * étudiants de la classe, en direct. */
enregistrerMiroir({
  cle: "edumanage-ressource-pedagogique-store-v1",
  parties: [
    partie<RessourcePedagogiqueRecord>({
      table: "ressources_pedagogiques",
      colonnes: ["id", "classeId", "classe", "ecId", "ec", "titre", "description", "nom", ["dataUrl", "fichier_chemin"], "tailleOctets", "url", "ajouteLe",
        "ajoutePar", "ajouteParId"],
      sansMiseAJour: true,
      fichiers: { dataUrl: { espace: "ressources", dossier: (r) => `${r.classeId}/${r.id}/` } },
      lire: getRessourcesPedagogiques,
      remplacer: remplacerRessourcesPedagogiques,
    }),
  ],
});
