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

/** Finances des étudiants reflétées dans la base (partie 7, lot 1), après les étudiants.
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
