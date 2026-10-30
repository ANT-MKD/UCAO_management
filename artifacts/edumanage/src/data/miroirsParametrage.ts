import { enregistrerMiroir, partie, type PartieMiroir } from "@/lib/miroirServeur";
import { typeSeanceStore, jourFerieStore, type TypeSeanceRecord, type JourFerieRecord } from "./scheduleSettingsStore";
import {
  typeFraisStore,
  modePaiementFinanceStore,
  typeFactureStore,
  modeleFraisStore,
  articleServiceStore,
  banqueStore,
  activiteServiceStore,
} from "./financeSettingsStore";
import { getGrillesFrais, remplacerGrillesFrais, type GrilleFraisRecord } from "./grilleFraisStore";
import {
  getGroupesExternes,
  getGroupesInternes,
  getGroupesPersonnalises,
  remplacerGroupesExternes,
  remplacerGroupesInternes,
  remplacerGroupesPersonnalises,
  type GroupeExterneRecord,
  type GroupeInterneRecord,
  type GroupePersonnaliseRecord,
} from "./communicationGroupsStore";
import { getCommunicationRoles, remplacerCommunicationRoles, type CommunicationRoleRecord } from "./communicationRolesStore";
import { getNotificationsEvenementielles, remplacerNotificationsEvenementielles, type NotificationEvenementielleRecord } from "./notificationEvenementielleStore";
import { getSignaturesDocuments, remplacerSignaturesDocuments, type SignatureDocumentRecord } from "./signatureConfigStore";
import { getEtablissementLignes, remplacerEtablissement, type EtablissementInfo } from "./etablissementStore";

/** Paramétrage de l'emploi du temps, des finances, de la communication, des signatures et identité
 * de l'établissement reflétés dans la base (partie 3, lot 4). Restent dans le navigateur :
 * l'adresse de la passerelle de communication (jamais de clé d'API dans la base), le logo et
 * l'image des signatures (stockage des fichiers, partie 4). */

/** Une liste de paramétrage (createListStore) et sa table. */
function liste<R extends { id: string }>(cle: string, table: string, store: { getAll: () => R[]; remplacer: (r: R[]) => void }, colonnes: PartieMiroir<R>["colonnes"]) {
  enregistrerMiroir({ cle, parties: [partie<R>({ table, colonnes, lire: store.getAll, remplacer: store.remplacer })] });
}

liste<TypeSeanceRecord>("edumanage-edt-type-seance-v1", "types_seance", typeSeanceStore, ["id", "code", "intitule", "categorie", "couleur", "trajet", "necessiteSurveillant"]);
liste<JourFerieRecord>("edumanage-edt-jour-ferie-v1", "jours_feries", jourFerieStore, ["id", "intitule", "dateDebut", "dateFin"]);

liste("edumanage-fin-type-frais-v1", "types_frais", typeFraisStore, ["id", "code", "intitule", "remarques"]);
liste("edumanage-fin-mode-paiement-v1", "modes_paiement", modePaiementFinanceStore, ["id", "code", "intitule"]);
liste("edumanage-fin-type-facture-v1", "types_facture", typeFactureStore, ["id", "code", "intitule", "facturePedagogique"]);
liste("edumanage-fin-modele-frais-v1", "modeles_frais", modeleFraisStore, ["id", "code", "intitule"]);
liste("edumanage-fin-article-service-v1", "articles_service", articleServiceStore, ["id", "code", "intitule", "prixUnitaire"]);
liste("edumanage-fin-banque-v1", "banques", banqueStore, ["id", "code", "intitule", "numeroCompte"]);
liste("edumanage-fin-activite-service-v1", "activites_service", activiteServiceStore, ["id", "code", "intitule", "montant"]);

enregistrerMiroir({
  cle: "edumanage-grille-frais-v1",
  parties: [partie<GrilleFraisRecord>({
    table: "grilles_frais",
    colonnes: ["id", "filiereId", "niveau", "annee", "modeleFraisId", "lignes"],
    defauts: { lignes: [] },
    lire: getGrillesFrais,
    remplacer: remplacerGrillesFrais,
  })],
});

enregistrerMiroir({
  cle: "edumanage-communication-groups-v1",
  parties: [
    partie<GroupeExterneRecord>({
      table: "groupes_externes",
      colonnes: ["id", "nom", "code", "contacts"],
      defauts: { code: "", contacts: [] },
      lire: getGroupesExternes,
      remplacer: remplacerGroupesExternes,
    }),
    partie<GroupeInterneRecord>({
      table: "groupes_internes",
      colonnes: ["id", "nom", "type", "refId", "niveauAlias", "annee"],
      lire: getGroupesInternes,
      remplacer: remplacerGroupesInternes,
    }),
    partie<GroupePersonnaliseRecord>({
      table: "groupes_personnalises",
      colonnes: ["id", "nom", "description", "regles"],
      defauts: { description: "", regles: [] },
      lire: getGroupesPersonnalises,
      remplacer: remplacerGroupesPersonnalises,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-communication-roles-v1",
  parties: [partie<CommunicationRoleRecord>({
    table: "roles_communication",
    colonnes: ["id", "role", ["userId", "compte_id"], ["userLabel", "compte_libelle"], "remarque", "action"],
    defauts: { userLabel: "" },
    lire: getCommunicationRoles,
    remplacer: remplacerCommunicationRoles,
  })],
});

enregistrerMiroir({
  cle: "edumanage-notification-evenementielle-v1",
  parties: [partie<NotificationEvenementielleRecord>({
    table: "notifications_evenementielles",
    colonnes: ["id", "code", "description", "actif", "envoyerEtudiant", "envoyerProfesseur", "envoyerParent", "envoyerTuteur", "brancheReellement"],
    defauts: { description: "" },
    lire: getNotificationsEvenementielles,
    remplacer: remplacerNotificationsEvenementielles,
  })],
});

enregistrerMiroir({
  cle: "edumanage-signature-config-v1",
  parties: [partie<SignatureDocumentRecord>({
    table: "signatures_documents",
    colonnes: ["id", "actif", "signataireNom", "signataireQualite"],
    lire: getSignaturesDocuments,
    remplacer: remplacerSignaturesDocuments,
  })],
});

enregistrerMiroir({
  cle: "edumanage-etablissement-v1",
  parties: [partie<EtablissementInfo & { id: string }>({
    table: "etablissement",
    colonnes: ["id", "nom", "adresse", "telephone", "email", "siteWeb", "agrement"],
    defauts: { telephone: "", email: "", siteWeb: "", agrement: "" },
    lire: getEtablissementLignes,
    remplacer: remplacerEtablissement,
    miseAJourSeule: true,
  })],
});
