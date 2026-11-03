import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import { fusionnerDossiersEnseignants, getTeachers, remplacerEnseignants, type TeacherRecord } from "./teacherStore";
import {
  fusionnerDossiersEtudiants,
  getEtudiants,
  getInscriptions,
  getPiecesEtudiants,
  remplacerEtudiants,
  remplacerInscriptions,
  remplacerPiecesEtudiants,
  type EtudiantRecord,
  type InscriptionRecord,
  type PieceEtudiantRecord,
} from "./studentStore";

/** Enseignants reflétés dans la base (partie 4) : la fiche publique, lue par tous, et le dossier
 * personnel avec la photo, lu par l'administration qui gère les professeurs et par l'enseignant
 * lui-même (qui y change son téléphone, son adresse et sa photo). */

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
      colonnes: ["id", "telephone", "email", "dateNaissance", "paysNaissance", "lieuNaissance", "nationalite", "cni", "adresse", "niveauEtude", "rib", "diplomes", "tauxHoraire",
        ["photoDataUrl", "photo_chemin"]],
      defauts: { telephone: "", diplomes: [], tauxHoraire: 0 },
      fichiers: { photoDataUrl: { espace: "photos", dossier: (t) => `enseignants/${t.id}/` } },
      lire: getTeachers,
      remplacer: fusionnerDossiersEnseignants,
      complementDe: "enseignants",
    }),
  ],
});

/** Étudiants reflétés dans la base, après les classes, les modèles de frais et les motifs de
 * blocage auxquels ils renvoient : la fiche scolaire, le dossier personnel avec la photo (lu par
 * l'administration et l'étudiant lui-même), les pièces déposées et vérifiées (lues par l'étudiant
 * et le secrétariat) et les inscriptions. Les soldes restent dans le navigateur jusqu'à la partie
 * Finances. Même clé de stockage que les années (studentStore), envoyée à son rang. */
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
        "typeAdmission", "documentsFournis", "inscriptionUniquePayee", "modeleFraisId", "motifBlocageId", ["photoDataUrl", "photo_chemin"]],
      defauts: { email: "", telephone: "", documentsFournis: [], inscriptionUniquePayee: false },
      nulSiVide: ["typeAdmission", "modeleFraisId", "motifBlocageId"],
      fichiers: { photoDataUrl: { espace: "photos", dossier: (e) => `etudiants/${e.id}/` } },
      lire: getEtudiants,
      remplacer: fusionnerDossiersEtudiants,
      complementDe: "etudiants",
    }),
    partie<PieceEtudiantRecord>({
      table: "pieces_etudiants",
      colonnes: ["id", "etudiantId", "piece", "fichier", "enVerification", "deposeLe", "motifRefus", "refuseLe"],
      fichiers: {
        fichier: { espace: "pieces", dossier: (p) => `${p.etudiantId}/${p.piece}/` },
        enVerification: { espace: "pieces", dossier: (p) => `${p.etudiantId}/${p.piece}/` },
      },
      lire: getPiecesEtudiants,
      remplacer: remplacerPiecesEtudiants,
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
