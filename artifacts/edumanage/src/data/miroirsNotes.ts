import { enregistrerMiroir, partie, type Portee } from "@/lib/miroirServeur";
import { getAnneesNotesChargees, getNotes, getReleves, remplacerNotes, remplacerReleves, type NoteRecord, type ReleveRecord } from "./studentStore";
import { getEvaluations, remplacerEvaluations, type EvaluationRecord } from "./evaluationStore";
import { getDemandesCorrection, remplacerDemandesCorrection, type DemandeCorrectionNoteRecord } from "./correctionNoteStore";
import { getGenerations, remplacerGenerations, type BulletinGenerationRecord } from "./bulletinGenerationStore";
import {
  getDeliberations, getLignesDeliberations, remplacerDeliberations, remplacerLignesDeliberations, type DeliberationRecord, type LigneDeliberationBase,
} from "./deliberationStore";
import {
  getDeliberationsAnnuelles, getLignesDeliberationsAnnuelles, remplacerDeliberationsAnnuelles, remplacerLignesDeliberationsAnnuelles,
  type DeliberationAnnuelleRecord, type LigneDeliberationAnnuelleBase,
} from "./deliberationAnnuelleStore";
import { getResultatsFigesLignes, remplacerResultatsFiges, type ResultatFigeLigne } from "./resultatsFigesStore";
import { getRepechages, remplacerRepechages, type RepechageUeRecord } from "./repechageStore";
import { getCreditDettes, remplacerCreditDettes, type CreditDetteRecord } from "./creditDetteStore";
import { getAttestations, remplacerAttestations, type AttestationRecord } from "./attestationStore";

/** Notes, évaluations et résultats lus : ceux des années utiles (l'année en cours, celles où un
 * étudiant actuel a été inscrit, et celles qu'un écran demande), par l'année de la ligne ou de sa
 * délibération. Les années plus anciennes ne concernent que des étudiants partis. */
function porteeNotes(colonne: string, jointure?: string): () => Portee | undefined {
  return () => {
    const annees = getAnneesNotesChargees();
    return annees ? { colonne, valeurs: annees, jointure } : undefined;
  };
}

/** Notes et résultats reflétés dans la base (partie 6), après les étudiants, les classes et
 * les cours auxquels ils renvoient.
 *
 * Évaluations (devoirs, examens, rattrapages) : lues par l'administration, par le professeur de ses
 * cours, par l'étudiant de sa classe ; écrites par les pages Évaluations, Saisie notes et
 * Rattrapage. Envoyées avant les notes qui les désignent. */
enregistrerMiroir({
  cle: "edumanage-evaluation-store-v1",
  parties: [
    partie<EvaluationRecord>({
      table: "evaluations",
      colonnes: ["id", "code", "filiereId", "filiere", "annee", "niveauId", "niveau", "classeId", "classe", "semestreId", "semestre", "ecId", "cours",
        "professeurId", "professeur", "type", "poids", "typeEvaluationId", "description", "creePar", "dateCreation", "modifiePar", "modifieLe", "session"],
      defauts: { code: "", filiere: "", niveau: "", classe: "", semestre: "", cours: "", professeur: "" },
      nulSiVide: ["filiereId", "niveauId", "semestreId", "professeurId", "typeEvaluationId"],
      portee: porteeNotes("annee"),
      lire: getEvaluations,
      remplacer: remplacerEvaluations,
    }),
  ],
});

/** Demandes de correction d'une note validée ou publiée. Envoyées avant les notes : la décision
 * « acceptée » part d'abord, et c'est la base qui corrige la note (le seul chemin qui change une
 * note officielle) ; la note du poste, déjà corrigée, part ensuite à l'identique. */
enregistrerMiroir({
  cle: "edumanage-corrections-notes-v1",
  parties: [
    partie<DemandeCorrectionNoteRecord>({
      table: "demandes_correction",
      colonnes: ["id", "noteId", "etudiantId", "etudiant", "matricule", "ecId", "ec", "classeId", "typeLabel", "ancienneNote", "ancienAbsent",
        "nouvelleNote", "nouvelAbsent", "motif", "demandeParId", "demandePar", "statut", "motifRefus", ["createdAt", "cree_le"], "traiteeLe", "traiteePar"],
      defauts: { etudiant: "", matricule: "", ec: "", typeLabel: "", ancienAbsent: false, nouvelAbsent: false, demandePar: "" },
      lire: getDemandesCorrection,
      remplacer: remplacerDemandesCorrection,
    }),
  ],
});

/** Notes, de la saisie à la publication : l'étudiant ne reçoit que ses notes publiées, le
 * professeur celles de ses cours. Même clé de stockage que les étudiants (studentStore), envoyée
 * à son rang. */
enregistrerMiroir({
  cle: "edumanage-app-store-v2",
  parties: [
    partie<NoteRecord>({
      table: "notes",
      colonnes: ["id", "etudiant", "etudiantId", "matricule", "ec", "ecId", "type", "note", "absent", "statut", "classeId", "annee", "session",
        "evaluationId", "dateCreation", "dateModification"],
      defauts: { etudiant: "", matricule: "", ec: "", absent: false },
      portee: porteeNotes("annee"),
      lire: getNotes,
      remplacer: remplacerNotes,
    }),
  ],
});

/** Relevés : l'étudiant ne reçoit que les siens. */
enregistrerMiroir({
  cle: "edumanage-app-store-v2",
  parties: [
    partie<ReleveRecord>({
      table: "releves",
      colonnes: ["id", "etudiantId", "etudiant", "matricule", "classe", "filiere", "semestre", "statut", "dateGeneration", "ecId", "semestreId", "annee"],
      defauts: { etudiant: "", matricule: "", classe: "", filiere: "", semestre: "", ecId: "" },
      nulSiVide: ["semestreId", "annee"],
      lire: getReleves,
      remplacer: remplacerReleves,
    }),
  ],
});

/** Générations de bulletins, numérotées par la base (le numéro du poste est provisoire). */
enregistrerMiroir({
  cle: "edumanage-bulletin-generation-store-v1",
  parties: [
    partie<BulletinGenerationRecord>({
      table: "bulletin_generations",
      colonnes: ["id", "numero", "filiereId", "filiere", "annee", "niveau", "niveauLabel", "classeId", "classe", "semestreId", "semestre", "effectueLe",
        "effectuePar", "statut", "nbSucces", "nbEchec", "nbDeclasses", "etudiantsConcernes"],
      defauts: { filiere: "", niveau: "", niveauLabel: "", classe: "", semestre: "", effectuePar: "", etudiantsConcernes: [] },
      nulSiVide: ["filiereId", "semestreId"],
      lire: getGenerations,
      remplacer: remplacerGenerations,
    }),
  ],
});

/** Délibérations du semestre : l'en-tête, puis une ligne par étudiant (l'étudiant ne reçoit que la
 * sienne). Avant les résultats figés et les attestations qui s'y rapportent. */
enregistrerMiroir({
  cle: "edumanage-deliberation-store-v1",
  parties: [
    partie<DeliberationRecord>({
      table: "deliberations",
      colonnes: ["id", "filiereId", "filiere", "annee", "niveau", "niveauLabel", "classeId", "classe", "semestreId", "semestre", "effectuePar",
        "dateDeliberation", "statut", "seuilOverride", "seuilOverrideRaison", "seuilOverrideModifiePar", "seuilOverrideModifieLe"],
      defauts: { filiere: "", niveau: "", niveauLabel: "", classe: "", semestre: "", effectuePar: "" },
      nulSiVide: ["filiereId"],
      portee: porteeNotes("annee"),
      lire: getDeliberations,
      remplacer: remplacerDeliberations,
    }),
    partie<LigneDeliberationBase>({
      table: "deliberations_lignes",
      colonnes: ["id", "deliberationId", "etudiantId", "etudiant", "matricule", "ordre", "moyenne", "creditsObtenus", "creditsTotal", "absences",
        "decisionAuto", "decisionFinale", "overrideRaison", "overrideModifiePar", "raisonsDeclassement"],
      defauts: { etudiant: "", matricule: "" },
      portee: porteeNotes("deliberations.annee", "deliberations!inner(annee)"),
      lire: getLignesDeliberations,
      remplacer: remplacerLignesDeliberations,
    }),
  ],
});

/** Bulletins figés à la clôture d'un jury (un par étudiant) : posés après la clôture, retirés
 * après la réouverture. */
enregistrerMiroir({
  cle: "edumanage-resultats-figes-v1",
  parties: [
    partie<ResultatFigeLigne>({
      table: "resultats_figes",
      colonnes: ["id", "deliberationId", "classeId", "semestreAlias", "etudiantId", "figeLe", "bulletin"],
      portee: porteeNotes("deliberations.annee", "deliberations!inner(annee)"),
      lire: getResultatsFigesLignes,
      remplacer: remplacerResultatsFiges,
    }),
  ],
});

/** UE repêchées par le jury : l'étudiant reçoit les siennes (elles comptent dans son bulletin). */
enregistrerMiroir({
  cle: "edumanage-repechage-ue-store-v1",
  parties: [
    partie<RepechageUeRecord>({
      table: "repechages_ue",
      colonnes: ["id", "etudiantId", "classeId", "ueId", "ueLibelle", "semestreAlias", "moyenne", "absences", "motif", "decidePar", "decideLe"],
      defauts: { ueLibelle: "", semestreAlias: "", decidePar: "" },
      lire: getRepechages,
      remplacer: remplacerRepechages,
    }),
  ],
});

/** Délibérations de l'année : l'en-tête, puis une ligne par étudiant ; avant les dettes de crédit
 * que leur clôture fait naître. */
enregistrerMiroir({
  cle: "edumanage-deliberation-annuelle-store-v1",
  parties: [
    partie<DeliberationAnnuelleRecord>({
      table: "deliberations_annuelles",
      colonnes: ["id", "filiereId", "filiere", "annee", "niveauId", "niveau", "niveauLabel", "classeId", "classe", "effectuePar", "dateDeliberation", "statut"],
      defauts: { filiere: "", niveau: "", niveauLabel: "", classe: "", effectuePar: "" },
      nulSiVide: ["filiereId", "niveauId"],
      portee: porteeNotes("annee"),
      lire: getDeliberationsAnnuelles,
      remplacer: remplacerDeliberationsAnnuelles,
    }),
    partie<LigneDeliberationAnnuelleBase>({
      table: "deliberations_annuelles_lignes",
      colonnes: ["id", "deliberationId", "etudiantId", "etudiant", "matricule", "ordre", "moyenneAnnuelle", "semestres", "creditsObtenus", "creditsTotal",
        "uesNonValidees", "decisionAuto", "decisionFinale", "overrideRaison", "overrideModifiePar"],
      defauts: { etudiant: "", matricule: "", moyenneAnnuelle: 0, uesNonValidees: [] },
      portee: porteeNotes("deliberations_annuelles.annee", "deliberations_annuelles!inner(annee)"),
      lire: getLignesDeliberationsAnnuelles,
      remplacer: remplacerLignesDeliberationsAnnuelles,
    }),
  ],
});

/** Dettes de crédit (AJAC) : l'étudiant reçoit les siennes. */
enregistrerMiroir({
  cle: "edumanage-credit-dette-store-v1",
  parties: [
    partie<CreditDetteRecord>({
      table: "credits_dette",
      colonnes: ["id", "etudiantId", "etudiant", "matricule", "ueId", "ueCode", "ueLibelle", "ueCredits", "filiereId", "filiere", "niveauOrigine",
        "niveauLabelOrigine", "semestreOrigine", "annee", "statut", "dateCreation", "dateSoldee", "soldeePar"],
      defauts: { etudiant: "", matricule: "", ueCode: "", ueLibelle: "", filiere: "", niveauOrigine: "", niveauLabelOrigine: "", semestreOrigine: "" },
      nulSiVide: ["filiereId"],
      lire: getCreditDettes,
      remplacer: remplacerCreditDettes,
    }),
  ],
});

/** Attestations, numérotées par la base ; une réussite y est vérifiée sur la délibération. */
enregistrerMiroir({
  cle: "edumanage-attestation-store-v1",
  parties: [
    partie<AttestationRecord>({
      table: "attestations",
      colonnes: ["id", "numero", "etudiantId", "etudiant", "matricule", "classeId", "classe", "filiereId", "filiere", "annee", "type", "typeLabel",
        "semestreId", "semestreLabel", "moyenneConstatee", "decisionConstatee", "soldeDuConstate", "statut", "dateGeneration", "effectuePar"],
      defauts: { etudiant: "", matricule: "", classe: "", filiere: "", typeLabel: "", soldeDuConstate: 0, effectuePar: "" },
      nulSiVide: ["classeId", "filiereId", "semestreId"],
      lire: getAttestations,
      remplacer: remplacerAttestations,
    }),
  ],
});
