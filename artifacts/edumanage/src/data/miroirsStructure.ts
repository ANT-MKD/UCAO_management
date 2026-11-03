import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import { cycleStore, entiteStore, categorieCoursStore } from "./academicSettingsStore";
import { getFilieres, remplacerFilieres, type FiliereRecord } from "./filiereStore";
import { getNiveaux, remplacerNiveaux, type NiveauRecord } from "./niveauStore";
import { getSemestres, remplacerSemestres, type SemestreRecord } from "./semestreStore";
import { getClasses, getSalles, remplacerClasses, remplacerSalles, type ClassePedagogiqueRecord, type SallePhysiqueRecord } from "./structureStore";
import { getEcs, getUes, remplacerEcs, remplacerUes, type EcRecord, type UeRecord } from "./curriculumStore";
import { getAnneesAcademiques, remplacerAnneesAcademiques, type AnneeAcademiqueRecord } from "./studentStore";

/** Structure académique reflétée dans la base (partie 3, lot 1) : tables de la migration
 * « structure_academique » et années académiques. Les compteurs calculés par l'application
 * (nombre de classes d'une filière, effectif d'une classe, nombre d'EC d'une UE) restent locaux. */

const listeSimple = (table: string, store: { getAll: () => { id: string }[]; remplacer: (r: never[]) => void }, colonnes: string[]) =>
  partie({ table, colonnes, lire: store.getAll, remplacer: (r) => store.remplacer(r as never[]) });

enregistrerMiroir({
  cle: "edumanage-app-store-v2",
  parties: [partie<AnneeAcademiqueRecord>({
    table: "annees_academiques",
    colonnes: ["id", "libelle", "actuelle", "cloturee", "archivee", "dateDebut", "dateFin"],
    defauts: { actuelle: false, cloturee: false, archivee: false },
    lire: getAnneesAcademiques,
    remplacer: remplacerAnneesAcademiques,
    // Une seule année courante à la fois : celle qui cesse de l'être part avant la nouvelle.
    ordreEnvoi: (a, b) => Number(a.actuelle) - Number(b.actuelle),
  })],
});

enregistrerMiroir({ cle: "edumanage-acad-cycle-v1", parties: [listeSimple("cycles", cycleStore, ["id", "code", "intitule", "ordre"])] });
enregistrerMiroir({ cle: "edumanage-acad-entite-v1", parties: [listeSimple("entites", entiteStore, ["id", "code", "intitule"])] });
enregistrerMiroir({ cle: "edumanage-acad-categorie-cours-v1", parties: [listeSimple("categories_cours", categorieCoursStore, ["id", "code", "intitule"])] });

enregistrerMiroir({
  cle: "edumanage-filiere-store-v1",
  parties: [partie<FiliereRecord>({
    table: "filieres",
    colonnes: ["id", "code", "nom", "responsable", "responsableId", "statut", "cycleId", "cycle", "entiteId", "entite", "typeProgramme", "anneesActives", "specialite", "informationsComplementaires"],
    defauts: { responsable: "", statut: "actif" },
    lire: getFilieres,
    remplacer: remplacerFilieres,
  })],
});

enregistrerMiroir({
  cle: "edumanage-niveau-store-v1",
  parties: [partie<NiveauRecord>({
    table: "niveaux",
    colonnes: ["id", "nom", "alias", "cycle", "cycleId", "filiere", "filiereId", "passageConditionnelAutorise", "creditDetteMin", "creditsRequisEntree"],
    defauts: { cycle: "", filiere: "" },
    lire: getNiveaux,
    remplacer: remplacerNiveaux,
  })],
});

enregistrerMiroir({
  cle: "edumanage-semestre-store-v1",
  parties: [partie<SemestreRecord>({
    table: "semestres",
    colonnes: ["id", "nom", "alias", "niveau", "niveauId", "filiere", "statut"],
    defauts: { niveau: "", filiere: "", statut: "actif" },
    lire: getSemestres,
    remplacer: remplacerSemestres,
  })],
});

enregistrerMiroir({
  cle: "edumanage-structure-store-v1",
  parties: [
    partie<SallePhysiqueRecord>({
      table: "salles",
      colonnes: ["id", "nom", "type", "capacite", "batiment", "etage", "equipements", "statut"],
      defauts: { type: "", capacite: 0, batiment: "", etage: "", equipements: [], statut: "actif" },
      lire: getSalles,
      remplacer: remplacerSalles,
    }),
    partie<ClassePedagogiqueRecord>({
      table: "classes",
      colonnes: ["id", "nom", "filiere", "filiereId", "niveau", "niveauId", "max", "delegue", "annee", "salleParDefautId", "cloturee", "dateCloture", "clotureePar", "observationCloture"],
      defauts: { filiere: "", niveau: "", delegue: "" },
      lire: getClasses,
      remplacer: remplacerClasses,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-curriculum-store-v1",
  parties: [
    partie<UeRecord>({
      table: "ues",
      colonnes: ["id", "code", "libelle", "credits", "filiere", "filiereId", "niveau", "semestre", "type", "obligatoire", "description"],
      defauts: { filiere: "", niveau: "", semestre: "", type: "", obligatoire: true },
      lire: getUes,
      remplacer: remplacerUes,
    }),
    partie<EcRecord>({
      table: "ecs",
      colonnes: ["id", "code", "libelle", "abrege", "ue", "ueId", "credits", "volCm", "volTd", "volTp", "volTpe", "vht", "responsable", "responsableId"],
      defauts: { ue: "", volCm: 0, volTd: 0, volTp: 0, volTpe: 0, vht: 0, responsable: "" },
      lire: getEcs,
      remplacer: remplacerEcs,
    }),
  ],
});
