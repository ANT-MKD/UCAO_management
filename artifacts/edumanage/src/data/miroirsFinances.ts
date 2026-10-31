import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import {
  getPaiements,
  remplacerQuittances,
  getMouvementsSolde,
  remplacerMouvementsSolde,
  getSoldesEtudiants,
  remplacerSoldes,
  type PaiementRecord,
  type MouvementSoldeRecord,
  type SoldeEtudiantLigne,
} from "./studentStore";
import { getEncaissements, remplacerEncaissements, type EncaissementRecord } from "./encaissementStore";
import { getFraisEtudiant, remplacerFraisEtudiant, type FraisEtudiantLigne } from "./fraisEtudiantStore";
import { reductionAutoriseeStore, type ReductionAutoriseeRecord } from "./financeSettingsStore";
import { getReductionsFrais, remplacerReductionsFrais, type ReductionFraisRecord } from "./reductionFraisStore";
import { getAvoirDepots, remplacerAvoirDepots, type AvoirDepotRecord } from "./avoirDepotStore";
import { getRemboursementsAvoir, remplacerRemboursementsAvoir, type RemboursementAvoirRecord } from "./remboursementAvoirStore";
import { getDerogationsPaiement, remplacerDerogationsPaiement, type DerogationPaiementRecord } from "./derogationPaiementStore";
import { getRelances, remplacerRelances, type RelanceRecord } from "./relancePaiementStore";
import { getRappelsPaiement, remplacerRappelsPaiement, type RappelPaiementRecord } from "./rappelPaiementStore";
import { getReprisFrais, remplacerReprisFrais, type ReprisFraisLigne } from "./reprisFraisStore";
import { getOrganismesPEC, remplacerOrganismesPEC, type OrganismePECRecord } from "./organismePECStore";
import { getPrisesEnCharge, remplacerPrisesEnCharge, type PriseEnChargeRecord } from "./priseEnChargeStore";
import { getPECsMasse, remplacerPECsMasse, type PECMasseRecord } from "./pecMasseStore";
import { getEncaissementsPEC, remplacerEncaissementsPEC, type EncaissementPECRecord } from "./encaissementPECStore";
import { getReglementsMasse, remplacerReglementsMasse, type ReglementMasseRecord } from "./reglementMasseStore";
import { getPaiementsDeclares, remplacerPaiementsDeclares, type PaiementDeclareRecord } from "./paiementDeclareStore";
import { getFacturesAutreService, remplacerFacturesAutreService, type FactureAutreServiceRecord } from "./factureAutreServiceStore";
import { getDevis, remplacerDevis, type DevisRecord } from "./devisStore";
import { getEmissionsMasse, remplacerEmissionsMasse, type EmissionMasseRecord } from "./emissionMasseStore";
import { getDecomptes, remplacerDecomptes, type DecompteRecord } from "./decompteStore";
import { getDecomptePaiements, remplacerDecomptePaiements, type DecomptePaiementRecord } from "./decomptePaiementStore";
import { getExportsComptables, remplacerExportsComptables, type ExportComptableRecord } from "./exportComptableStore";

/** Finances reflétées dans la base (partie 7), après les étudiants et les enseignants.
 *
 * Quittances : numérotées par la base (le numéro du poste est provisoire et revient corrigé juste
 * après) ; leur montant réglé n'y part jamais en valeur. Mouvements : chaque écart de solde dû,
 * d'avoir ou de montant réglé noté sur ce poste, envoyé une fois, que la base additionne. Soldes :
 * tenus par la base seule, relus après chaque envoi numéroté et au suivi des changements. Même clé
 * de stockage que les étudiants (studentStore), envoyée à son rang. */
enregistrerMiroir({
  cle: "edumanage-app-store-v2",
  parties: [
    partie<PaiementRecord>({
      table: "quittances",
      colonnes: ["id", "numeroRecu", "date", "etudiantId", "etudiant", "classe", "rubrique", "lignes", "montant", "moyen", "reference", "soldeRestant",
        "statut", "dateLimite"],
      defauts: { etudiant: "", classe: "", rubrique: "", moyen: "", reference: "", soldeRestant: 0 },
      nulSiVide: ["dateLimite"],
      numeroteeParLaBase: true,
      lire: getPaiements,
      remplacer: remplacerQuittances,
    }),
    partie<MouvementSoldeRecord>({
      table: "mouvements_solde",
      colonnes: ["id", "etudiantId", "quittanceId", "deltaDu", "deltaAvoir", "deltaPaye", "motif"],
      ajoutSeul: true,
      lire: getMouvementsSolde,
      remplacer: remplacerMouvementsSolde,
    }),
    partie<SoldeEtudiantLigne>({
      table: "soldes_etudiants",
      colonnes: ["id", "soldeDu", "soldeAvoir"],
      lectureSeule: true,
      lire: getSoldesEtudiants,
      remplacer: remplacerSoldes,
    }),
  ],
});

/** Encaissements : un versement sur une quittance, avec son propre reçu numéroté par la base ;
 * ensuite seule son annulation part. */
enregistrerMiroir({
  cle: "edumanage-encaissements-v1",
  parties: [
    partie<EncaissementRecord>({
      table: "encaissements",
      colonnes: ["id", "reference", "date", "quittanceId", "quittanceReference", "quittanceDateEmission", "quittanceDateLimite", "montantQuittanceTotal",
        "etudiantId", "payeur", "filiere", "annee", "montant", "moyen", "referenceBancaire", "encaissePar", "annulee", "lignes"],
      defauts: { payeur: "", filiere: "", annee: "", moyen: "", encaissePar: "", annulee: false, lignes: [] },
      nulSiVide: ["quittanceDateEmission", "quittanceDateLimite", "referenceBancaire"],
      numeroteeParLaBase: true,
      lire: getEncaissements,
      remplacer: remplacerEncaissements,
    }),
  ],
});

/** Frais ajoutés aux étudiants, après les quittances qui les facturent. */
enregistrerMiroir({
  cle: "edumanage-frais-etudiant-v1",
  parties: [
    partie<FraisEtudiantLigne>({
      table: "frais_etudiants",
      colonnes: ["id", "etudiantId", "annee", "typeFraisId", "montant", "dateLimite", "obligatoire", "echeance", "nbEcheances", "ajouteLe", "quittanceId",
        "quittanceDate", "annulee", "motifAnnulation"],
      defauts: { obligatoire: false, echeance: false, annulee: false },
      nulSiVide: ["dateLimite", "quittanceId", "quittanceDate"],
      lire: getFraisEtudiant,
      remplacer: remplacerFraisEtudiant,
    }),
  ],
});

// ——— Lots 2 à 4 : réductions, avoirs, dérogations, relances, reprises ; prises en charge,
// paiements déclarés, factures, devis, émissions ; décomptes des enseignants et exports. ———
// Chaque pièce numérotée par la base est relue juste après son ajout (numéro définitif) ; les
// soldes qu'elle change partent en mouvements (lot 1).

/** Autorisations de réduction (taux maximal, plafond de la période), par personne. */
enregistrerMiroir({
  cle: "edumanage-fin-reduction-autorisee-v1",
  parties: [
    partie<ReductionAutoriseeRecord>({
      table: "reductions_autorisees",
      colonnes: ["id", "personnelId", "tauxMax", "montantPlafond", "dateDebut", "dateFin"],
      lire: reductionAutoriseeStore.getAll,
      remplacer: reductionAutoriseeStore.remplacer,
    }),
  ],
});

/** Réductions accordées : la base vérifie l'autorisation de leur auteur. */
enregistrerMiroir({
  cle: "edumanage-reduction-frais-v1",
  parties: [
    partie<ReductionFraisRecord>({
      table: "reductions_frais",
      colonnes: ["id", "reference", "date", "etudiantId", "personnelId", "tauxApplique", "totalReduit", "annulee"],
      defauts: { annulee: false },
      numeroteeParLaBase: true,
      lire: getReductionsFrais,
      remplacer: remplacerReductionsFrais,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-avoir-depots-v1",
  parties: [
    partie<AvoirDepotRecord>({
      table: "avoirs_depots",
      colonnes: ["id", "reference", "date", "etudiantId", "payeur", "montant", "motif", "moyenOrigine", "referenceBancaire", "ajouteePar", "annulee"],
      defauts: { payeur: "", motif: "", moyenOrigine: "", ajouteePar: "", annulee: false },
      nulSiVide: ["referenceBancaire"],
      numeroteeParLaBase: true,
      lire: getAvoirDepots,
      remplacer: remplacerAvoirDepots,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-avoir-remboursements-v1",
  parties: [
    partie<RemboursementAvoirRecord>({
      table: "avoirs_remboursements",
      colonnes: ["id", "reference", "date", "etudiantId", "payeur", "montant", "motif", "moyenRemboursement", "referenceBancaire", "ajouteePar", "annulee"],
      defauts: { payeur: "", motif: "", moyenRemboursement: "", ajouteePar: "", annulee: false },
      nulSiVide: ["referenceBancaire"],
      numeroteeParLaBase: true,
      lire: getRemboursementsAvoir,
      remplacer: remplacerRemboursementsAvoir,
    }),
  ],
});

/** Dérogations : l'étudiant lit les siennes ; seule la révocation se note ensuite. */
enregistrerMiroir({
  cle: "edumanage-derogation-paiement-v1",
  parties: [
    partie<DerogationPaiementRecord>({
      table: "derogations_paiement",
      colonnes: ["id", "reference", "date", "etudiantId", "etudiantLabel", "soldeDuConstate", "portee", "motif", "personnelId", "personnelLabel", "dateDebut",
        "dateFin", "revoquee", "motifRevocation", "revoqueeLe"],
      defauts: { etudiantLabel: "", personnelLabel: "", soldeDuConstate: 0, revoquee: false },
      nulSiVide: ["motifRevocation", "revoqueeLe"],
      numeroteeParLaBase: true,
      lire: getDerogationsPaiement,
      remplacer: remplacerDerogationsPaiement,
    }),
  ],
});

/** Relances : la base prévient l'étudiant. */
enregistrerMiroir({
  cle: "edumanage-relance-paiement-v1",
  parties: [
    partie<RelanceRecord>({
      table: "relances_paiement",
      colonnes: ["id", "etudiantId", "dateEnvoi", "dateEcheance", "montantDu", "envoyePar", "statut"],
      nulSiVide: ["envoyePar"],
      lire: getRelances,
      remplacer: remplacerRelances,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-rappel-paiement-v1",
  parties: [
    partie<RappelPaiementRecord>({
      table: "rappels_paiement",
      colonnes: ["id", "reference", "date", "filiereId", "filiereLabel", "niveau", "niveauLabel", "annee", "fraisEchusAvant", "nouvelleEcheance", "quittanceIds",
        "nbEtudiants", "nbNotificationsEnvoyees"],
      defauts: { filiereLabel: "", annee: "", quittanceIds: [], nbEtudiants: 0, nbNotificationsEnvoyees: 0 },
      nulSiVide: ["filiereId", "niveau", "niveauLabel", "nouvelleEcheance"],
      numeroteeParLaBase: true,
      lire: getRappelsPaiement,
      remplacer: remplacerRappelsPaiement,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-reprise-frais-v1",
  parties: [
    partie<ReprisFraisLigne>({
      table: "reprises_frais",
      colonnes: ["id", "ancienCode", "nom", "prenom", "libelleAnneeScolaire", "montant", "etudiantId", "statut", "importeLe", "motifRejet"],
      defauts: { nom: "", prenom: "", libelleAnneeScolaire: "" },
      nulSiVide: ["etudiantId", "motifRejet"],
      lire: getReprisFrais,
      remplacer: remplacerReprisFrais,
    }),
  ],
});

/** Organismes, puis leurs prises en charge (le versé est recalculé par la base), les lots en masse,
 * les encaissements des organismes et les règlements en masse. */
enregistrerMiroir({
  cle: "edumanage-organismes-pec-v1",
  parties: [
    partie<OrganismePECRecord>({
      table: "organismes_pec",
      colonnes: ["id", "intitule", "adresse", "telephone", "email", "remarques", "contactNom", "contactTelephone", "contactEmail"],
      defauts: { adresse: "", contactNom: "" },
      nulSiVide: ["telephone", "email", "remarques", "contactTelephone", "contactEmail"],
      lire: getOrganismesPEC,
      remplacer: remplacerOrganismesPEC,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-prises-en-charge-v1",
  parties: [
    partie<PriseEnChargeRecord>({
      table: "prises_en_charge",
      colonnes: ["id", "reference", "referenceExterne", "type", "dateSaisie", "organismeId", "organisme", "etudiantId", "etudiant", "filiere", "annee", "debut", "fin",
        "dateLimite", "montant", "pourcentage", "document", "ajouteePar", "lignes", "annulee", "montantEncaisse"],
      defauts: { organisme: "", etudiant: "", filiere: "", annee: "", ajouteePar: "", lignes: [], annulee: false, montantEncaisse: 0 },
      nulSiVide: ["referenceExterne", "document"],
      numeroteeParLaBase: true,
      lire: getPrisesEnCharge,
      remplacer: remplacerPrisesEnCharge,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-pec-masse-v1",
  parties: [
    partie<PECMasseRecord>({
      table: "pec_masse",
      colonnes: ["id", "reference", "organismeId", "organisme", "type", "montant", "pourcentage", "filiereId", "filiere", "annee", "niveauId", "niveau", "classeId",
        "classe", "debut", "fin", "dateLimite", "filtreFrais", "emisLe", "ajouteePar", "priseEnChargeIds", "annulee"],
      defauts: { organisme: "", filiere: "", annee: "", niveau: "", classe: "", ajouteePar: "", priseEnChargeIds: [], annulee: false },
      nulSiVide: ["filiereId", "niveauId", "classeId", "filtreFrais"],
      numeroteeParLaBase: true,
      lire: getPECsMasse,
      remplacer: remplacerPECsMasse,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-encaissements-pec-v1",
  parties: [
    partie<EncaissementPECRecord>({
      table: "encaissements_pec",
      colonnes: ["id", "reference", "organismeId", "organisme", "date", "modePaiement", "referenceBancaire", "ajouteePar", "lignes", "annulee"],
      defauts: { organisme: "", modePaiement: "", ajouteePar: "", lignes: [], annulee: false },
      nulSiVide: ["referenceBancaire"],
      numeroteeParLaBase: true,
      lire: getEncaissementsPEC,
      remplacer: remplacerEncaissementsPEC,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-reglements-masse-v1",
  parties: [
    partie<ReglementMasseRecord>({
      table: "reglements_masse",
      colonnes: ["id", "reference", "organismeId", "organisme", "annee", "date", "modePaiement", "referenceBancaire", "montantGlobal", "ajouteePar", "lignes", "annulee"],
      defauts: { organisme: "", annee: "", modePaiement: "", ajouteePar: "", lignes: [], annulee: false },
      nulSiVide: ["referenceBancaire"],
      numeroteeParLaBase: true,
      lire: getReglementsMasse,
      remplacer: remplacerReglementsMasse,
    }),
  ],
});

/** Paiements déclarés en ligne : l'étudiant déclare, la caisse confirme ou rejette ; la base
 * prévient l'une puis l'autre. */
enregistrerMiroir({
  cle: "edumanage-paiements-declares-v1",
  parties: [
    partie<PaiementDeclareRecord>({
      table: "paiements_declares",
      colonnes: ["id", "quittanceId", "quittanceReference", "rubrique", "etudiantId", "etudiantLabel", "montant", "moyen", "telephone", "referenceTransaction",
        "declareLe", "statut", "traiteLe", "traitePar", "motifRejet"],
      defauts: { quittanceReference: "", rubrique: "", etudiantLabel: "", telephone: "" },
      nulSiVide: ["traiteLe", "traitePar", "motifRejet"],
      lire: getPaiementsDeclares,
      remplacer: remplacerPaiementsDeclares,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-factures-autres-services-v1",
  parties: [
    partie<FactureAutreServiceRecord>({
      table: "factures_autres_services",
      colonnes: ["id", "reference", "date", "beneficiaire", "telephone", "adresse", "referenceExterne", "remarque", "lignes", "montant", "moyen",
        "referenceBancairePaiement", "datePaiement", "ajouteePar", "statut"],
      defauts: { remarque: "", ajouteePar: "", montant: 0 },
      nulSiVide: ["telephone", "adresse", "referenceExterne", "moyen", "referenceBancairePaiement", "datePaiement"],
      numeroteeParLaBase: true,
      lire: getFacturesAutreService,
      remplacer: remplacerFacturesAutreService,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-devis-v1",
  parties: [
    partie<DevisRecord>({
      table: "devis",
      colonnes: ["id", "reference", "date", "filiereId", "filiereLabel", "niveau", "niveauLabel", "annee", "modeleFraisId", "modeleFraisLabel", "beneficiaire",
        "telephone", "email", "adresse", "tauxTaxe", "lignes", ["totalHT", "total_ht"], "totalTaxe", ["totalTTC", "total_ttc"], "ajouteePar", "annule",
        "convertiEtudiantId"],
      defauts: { filiereLabel: "", niveau: "", niveauLabel: "", annee: "", modeleFraisLabel: "", telephone: "", tauxTaxe: 0, lignes: [], ajouteePar: "", annule: false },
      nulSiVide: ["filiereId", "modeleFraisId", "email", "adresse", "convertiEtudiantId"],
      numeroteeParLaBase: true,
      lire: getDevis,
      remplacer: remplacerDevis,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-emissions-masse-v1",
  parties: [
    partie<EmissionMasseRecord>({
      table: "emissions_masse",
      colonnes: ["id", "reference", "filiereId", "filiere", "annee", "niveauId", "niveau", "classeId", "classe", "modeleFraisId", "ligneIntitules", "dateFacturation",
        "commentaire", "emisLe", "emisPar", "quittanceIds", "annulee"],
      defauts: { filiere: "", annee: "", niveau: "", classe: "", ligneIntitules: [], commentaire: "", emisPar: "", quittanceIds: [], annulee: false },
      nulSiVide: ["filiereId", "niveauId", "classeId", "modeleFraisId"],
      numeroteeParLaBase: true,
      lire: getEmissionsMasse,
      remplacer: remplacerEmissionsMasse,
    }),
  ],
});

/** Décomptes des enseignants, recalculés par la base (lignes, totaux, payé), puis leurs paiements. */
enregistrerMiroir({
  cle: "edumanage-decomptes-v1",
  parties: [
    partie<DecompteRecord>({
      table: "decomptes",
      colonnes: ["id", "reference", "date", "teacherId", "professeur", "type", "annee", "montantDecompte", "netAPayer", "montantPaye", "statut", "ajouteePar", "lignes"],
      defauts: { professeur: "", ajouteePar: "", montantPaye: 0 },
      numeroteeParLaBase: true,
      lire: getDecomptes,
      remplacer: remplacerDecomptes,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-decompte-paiements-v1",
  parties: [
    partie<DecomptePaiementRecord>({
      table: "paiements_decomptes",
      colonnes: ["id", "reference", "date", "decompteId", "decompteReference", "decompteDateEmission", "montantDecompteTotal", "abattementMontant", "teacherId",
        "professeur", "montant", "moyen", "referenceBancaire", "payePar", "annulee", "lignes"],
      defauts: { decompteReference: "", professeur: "", moyen: "", payePar: "", annulee: false, lignes: [] },
      nulSiVide: ["decompteDateEmission", "referenceBancaire"],
      numeroteeParLaBase: true,
      lire: getDecomptePaiements,
      remplacer: remplacerDecomptePaiements,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-export-comptable-v1",
  parties: [
    partie<ExportComptableRecord>({
      table: "exports_comptables",
      colonnes: ["id", "reference", "date", "genereePar", "periodeDebut", "periodeFin", "categories", "parCategorie", "totalRecettes", "totalDepenses",
        "totalAjustements", "soldeNet", "nbLignes"],
      defauts: { genereePar: "", categories: [], parCategorie: [] },
      numeroteeParLaBase: true,
      lire: getExportsComptables,
      remplacer: remplacerExportsComptables,
    }),
  ],
});
