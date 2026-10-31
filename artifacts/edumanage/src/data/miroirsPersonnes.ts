import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import { fusionnerDossiersEnseignants, getTeachers, remplacerEnseignants, type TeacherRecord } from "./teacherStore";

/** Enseignants reflétés dans la base (partie 4) : la fiche publique, lue par tous, et le dossier
 * personnel, lu par l'administration qui gère les professeurs et par l'enseignant lui-même. La
 * photo reste dans le navigateur jusqu'à l'espace de fichiers (lot 3). */

enregistrerMiroir({
  cle: "edumanage-teacher-store-v1",
  parties: [
    partie<TeacherRecord>({
      table: "enseignants",
      colonnes: ["id", "prenom", "nom", "matricule", "sexe", "grade", "specialite", "specialites"],
      defauts: { specialite: "", specialites: [] },
      lire: getTeachers,
      remplacer: remplacerEnseignants,
    }),
    partie<TeacherRecord>({
      table: "enseignants_dossiers",
      colonnes: ["id", "telephone", "email", "dateNaissance", "paysNaissance", "lieuNaissance", "nationalite", "cni", "adresse", "niveauEtude", "rib", "diplomes", "tauxHoraire"],
      defauts: { telephone: "", diplomes: [], tauxHoraire: 0 },
      lire: getTeachers,
      remplacer: fusionnerDossiersEnseignants,
      complementDe: "enseignants",
    }),
  ],
});
