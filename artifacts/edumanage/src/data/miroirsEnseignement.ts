import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import {
  getCahiersEnregistres,
  getFichiersCahiers,
  getPresencesCahiers,
  getSeances,
  remplacerCahiers,
  remplacerFichiersCahiers,
  remplacerPresencesCahiers,
  remplacerSeances,
  type CahierSeanceRecord,
  type FichierCahierRecord,
  type PresenceCahierRecord,
  type SeanceRecord,
} from "./studentStore";
import { getEvenements, remplacerEvenements, type EvenementRecord } from "./evenementStore";
import { getPointages, remplacerPointages, type PointageRecord } from "./pointageStore";
import { getAbsencesPeriode, remplacerAbsencesPeriode, type AbsencePeriodeRecord } from "./absencePeriodeStore";
import { getPortefeuilleCours, remplacerPortefeuilleCours, type PortefeuilleCoursRecord } from "./portefeuilleCoursStore";

/** Enseignement reflété dans la base (partie 5), après les cours, les classes, les salles et les
 * enseignants auxquels il renvoie.
 *
 * Emploi du temps : chaque compte ne reçoit que les séances qu'il lit (toutes pour
 * l'administration, les siennes pour un professeur, celles de sa classe pour un étudiant) ; seule
 * la page « Emploi du temps » les modifie.
 * Cahiers de séance, avec leur appel et leurs fichiers (photos du tableau, pièces jointes, dans
 * l'espace de fichiers « cahiers ») : un étudiant ne reçoit que les cahiers soumis de sa classe et
 * ses propres présences. Même clé de stockage que les étudiants (studentStore), envoyée à son rang. */
enregistrerMiroir({
  cle: "edumanage-app-store-v2",
  parties: [
    partie<SeanceRecord>({
      table: "seances",
      colonnes: ["id", "ec", "ecId", "classe", "classeId", "jour", "semaineDu", "heureDebut", "heureFin", "salle", "salleId", "prof", "profId", "type", "annee"],
      defauts: { ec: "", classe: "", salle: "", prof: "", type: "" },
      nulSiVide: ["salleId", "profId"],
      lire: getSeances,
      remplacer: remplacerSeances,
    }),
    partie<CahierSeanceRecord>({
      table: "cahiers",
      colonnes: ["id", "seanceId", "annee", "semestre", "departement", "filiere", "filiereId", "niveau", "ue", "ueId", "ec", "ecId", "classeId", "classe",
        "prof", "profId", "salle", "salleId", "date", "heureDebut", "heureFin", "typeSeance", "sujet", "resume", "competences", "liensExternes",
        "travail", "evaluation", "tauxPresence", "etatSeance", "motifAnnulation", "statut", ["validatedBy", "valide_par"], ["createdAt", "cree_le"],
        ["updatedAt", "modifie_le"]],
      defauts: { semestre: "", departement: "", filiere: "", niveau: "", ue: "", ec: "", classe: "", prof: "", salle: "", typeSeance: "", sujet: "",
        resume: "", competences: "", liensExternes: [], tauxPresence: 0 },
      nulSiVide: ["filiereId", "ueId", "profId", "salleId"],
      lire: getCahiersEnregistres,
      remplacer: remplacerCahiers,
    }),
    partie<PresenceCahierRecord>({
      table: "presences",
      colonnes: ["id", "cahierId", "etudiantId", "nom", "statut", "justification", "retardMinutes", "ordre"],
      defauts: { nom: "" },
      lire: getPresencesCahiers,
      remplacer: remplacerPresencesCahiers,
    }),
    partie<FichierCahierRecord>({
      table: "cahiers_fichiers",
      colonnes: ["id", "cahierId", "genre", "ordre", "nom", "type", "tailleKo", "ref", ["fichier", "chemin"]],
      defauts: { nom: "", type: "" },
      fichiers: { fichier: { espace: "cahiers", dossier: (f) => `${f.cahierId}/` } },
      lire: getFichiersCahiers,
      remplacer: remplacerFichiersCahiers,
    }),
  ],
});

/** Pointages : ceux qu'un cahier validé fait naître sont créés par la base elle-même (l'écran les
 * reçoit juste après la validation) ; les autres sont saisis et traités par les pages Pointage. Un
 * professeur ne reçoit que les siens. */
enregistrerMiroir({
  cle: "edumanage-pointages-v1",
  parties: [
    partie<PointageRecord>({
      table: "pointages",
      colonnes: ["id", "teacherId", "ecId", "classeId", "annee", "seanceId", "cahierId", "date", "heureDebut", "heureFin", "type", "salleId",
        "volumePointe", "remarque", "statut", "motifRejet", ["createdAt", "cree_le"]],
      nulSiVide: ["seanceId", "cahierId", "salleId"],
      lire: getPointages,
      remplacer: remplacerPointages,
    }),
  ],
});

/** Absences déclarées sur une période, lues par l'administration, l'étudiant concerné et les
 * professeurs de sa classe (pour l'appel). */
enregistrerMiroir({
  cle: "edumanage-absence-periode-v1",
  parties: [
    partie<AbsencePeriodeRecord>({
      table: "absences_periodes",
      colonnes: ["id", "etudiantId", "etudiant", "matricule", "classeId", "classe", "filiereId", "filiere", "niveau", "annee", "dateDebut", "dateFin",
        "motif", "justifie", "justificatif", "declarePar", "dateDeclaration"],
      defauts: { etudiant: "", matricule: "", classe: "", filiere: "", niveau: "", motif: "" },
      nulSiVide: ["classeId", "filiereId"],
      lire: getAbsencesPeriode,
      remplacer: remplacerAbsencesPeriode,
    }),
  ],
});

/** Portefeuille de cours (étudiant ajouté à un cours d'une autre classe, ou retiré d'un cours de
 * la sienne) : la dernière action compte. */
enregistrerMiroir({
  cle: "edumanage-portefeuille-cours-v1",
  parties: [
    partie<PortefeuilleCoursRecord>({
      table: "portefeuille_cours",
      colonnes: ["id", "etudiantId", "etudiant", "matricule", "classeId", "classe", "ecId", "ec", "action", "dateAction", "effectuePar", "motif"],
      defauts: { etudiant: "", matricule: "", classe: "", ec: "" },
      lire: getPortefeuilleCours,
      remplacer: remplacerPortefeuilleCours,
    }),
  ],
});

/** Événements ponctuels (soutenances, examens…), lus par tous les comptes connectés. */
enregistrerMiroir({
  cle: "edumanage-evenements-v1",
  parties: [
    partie<EvenementRecord>({
      table: "evenements",
      colonnes: ["id", "objet", "date", "typeId", "type", "classeId", "classe", "salleId", "salle", "heureDebut", "heureFin", "surveillant", "remarque", ["createdAt", "cree_le"]],
      defauts: { type: "" },
      nulSiVide: ["classeId", "salleId"],
      lire: getEvenements,
      remplacer: remplacerEvenements,
    }),
  ],
});
