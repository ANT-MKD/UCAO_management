import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import { getSeances, remplacerSeances, type SeanceRecord } from "./studentStore";
import { getEvenements, remplacerEvenements, type EvenementRecord } from "./evenementStore";

/** Enseignement reflété dans la base (partie 5), après les cours, les classes, les salles et les
 * enseignants auxquels il renvoie.
 *
 * Emploi du temps : chaque compte ne reçoit que les séances qu'il lit (toutes pour
 * l'administration, les siennes pour un professeur, celles de sa classe pour un étudiant) ; seule
 * la page « Emploi du temps » les modifie. Même clé de stockage que les étudiants (studentStore),
 * envoyée à son rang. */
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
