import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import { getNotes, remplacerNotes, type NoteRecord } from "./studentStore";
import { getEvaluations, remplacerEvaluations, type EvaluationRecord } from "./evaluationStore";
import { getDemandesCorrection, remplacerDemandesCorrection, type DemandeCorrectionNoteRecord } from "./correctionNoteStore";

/** Notes et résultats reflétés dans la base (partie 6, lot 1), après les étudiants, les classes et
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
      lire: getNotes,
      remplacer: remplacerNotes,
    }),
  ],
});
