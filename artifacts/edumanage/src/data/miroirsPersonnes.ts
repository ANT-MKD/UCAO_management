import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import { fusionnerDossiersEnseignants, getTeachers, remplacerEnseignants, type TeacherRecord } from "./teacherStore";
import {
  fusionnerDossiersEtudiants,
  getEtudiants,
  getInscriptions,
  remplacerEtudiants,
  remplacerInscriptions,
  type EtudiantRecord,
  type InscriptionRecord,
} from "./studentStore";

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

/** Étudiants reflétés dans la base, après les classes, les modèles de frais et les motifs de
 * blocage auxquels ils renvoient : la fiche scolaire, le dossier personnel (lu par l'administration
 * et l'étudiant lui-même) et les inscriptions. Les soldes, la photo et les pièces déposées restent
 * dans le navigateur (partie Finances, espace de fichiers). Même clé de stockage que les années
 * (studentStore), envoyée à son rang. */
enregistrerMiroir({
  cle: "edumanage-app-store-v2",
  parties: [
    partie<EtudiantRecord>({
      table: "etudiants",
      colonnes: ["id", "matricule", "prenom", "nom", "sexe", "filiere", "filiereId", "classe", "classeId", "niveau", "statut", "annee", "anneePremiereInscription"],
      defauts: { filiere: "", classe: "", niveau: "" },
      nulSiVide: ["classeId", "sexe"],
      lire: getEtudiants,
      remplacer: remplacerEtudiants,
    }),
    partie<EtudiantRecord>({
      table: "etudiants_dossiers",
      colonnes: ["id", "email", "telephone", "dateNaissance", "lieuNaissance", "pays", "nationalite", "cni", "adresse", "nomTuteur", "telTuteur",
        "typeAdmission", "documentsFournis", "inscriptionUniquePayee", "modeleFraisId", "motifBlocageId"],
      defauts: { email: "", telephone: "", documentsFournis: [], inscriptionUniquePayee: false },
      nulSiVide: ["typeAdmission", "modeleFraisId", "motifBlocageId"],
      lire: getEtudiants,
      remplacer: fusionnerDossiersEtudiants,
      complementDe: "etudiants",
    }),
    partie<InscriptionRecord>({
      table: "inscriptions",
      colonnes: ["id", "etudiantId", "annee", "filiere", "filiereId", "niveau", "classe", "classeId", "statut", "type", "dateInscription",
        "specialite", "modeleFraisId", "modeleFrais", "motif", "effectuePar"],
      defauts: { filiere: "", classe: "", niveau: "" },
      nulSiVide: ["classeId", "modeleFraisId"],
      lire: getInscriptions,
      remplacer: remplacerInscriptions,
    }),
  ],
});
