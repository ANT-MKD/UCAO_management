import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import {
  getScolariteConfigs,
  getValeursParDefaut,
  remplacerScolariteConfigs,
  remplacerValeursParDefaut,
  type ScolariteConfigRecord,
  type ValeursParDefaut,
} from "./scolariteConfigStore";
import { getReglesValidation, remplacerReglesValidation, type RegleValidationRecord } from "./reglesValidationStore";
import { getHistorique, getReglements, remplacerHistorique, remplacerReglements, type ReglementCalcul, type VersionReglement } from "./reglementCalculStore";
import { getMethodesCalcul, remplacerMethodesCalcul, type MethodeCalculRecord } from "./bulletinMethodesStore";
import { getMentions, remplacerMentions, type MentionRecord } from "./mentionsStore";
import { getTypesEvaluation, remplacerTypesEvaluation, type TypeEvaluationRecord } from "./typeEvaluationStore";
import { getRegroupementsDevoir, remplacerRegroupementsDevoir, type RegroupementDevoirRecord } from "./regroupementDevoirStore";
import { getDeclassementParametres, remplacerDeclassementParametres, type DeclassementParametreRecord } from "./declassementParametreStore";

/** Paramétrage de la scolarité et des bulletins reflété dans la base (partie 3, lot 3 : tables de
 * la migration « scolarite_bulletins »). Les réglages par défaut que l'application calcule (une
 * configuration par filière, les mentions et méthodes de départ…) restent dans le navigateur tant
 * qu'un compte autorisé n'enregistre pas ce paramétrage ; ils partent alors avec lui. */

type ValeursAvecId = ValeursParDefaut & { id: string };

enregistrerMiroir({
  cle: "edumanage-scolarite-config-v1",
  parties: [
    partie<ValeursAvecId>({
      table: "scolarite_valeurs_defaut",
      colonnes: ["id", "noteBareme", "cumulCredit", "moyennePassage", "moyenneEliminatoire", "modifiePar", "modifieLe"],
      lire: () => [{ id: "etablissement", ...getValeursParDefaut() }],
      remplacer: (fiches) => {
        const valeurs = fiches[0];
        if (!valeurs) return remplacerValeursParDefaut(undefined);
        const { id: _id, ...reste } = valeurs;
        remplacerValeursParDefaut(reste);
      },
      // Jamais réglées par un administrateur : les valeurs de l'application, sur chaque poste.
      envoyable: (v) => !!v.modifiePar,
    }),
    partie<ScolariteConfigRecord>({
      table: "scolarite_configs",
      colonnes: ["id", "filiereId", "filiere", "noteBareme", "cumulCredit", "moyennePassage", "moyenneEliminatoire",
        "methodeCalculMoyUeId", "methodeCalculMoySessionId", "methodeCalculMoyAnneeId", "methodeCalculMoyProgrammeId",
        "calculGrade", "reglesCalcul", "formulesCalcul", "formulesModifieesPar", "formulesModifieesLe", "modifiePar", "modifieLe"],
      defauts: { filiere: "" },
      lire: getScolariteConfigs,
      remplacer: remplacerScolariteConfigs,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-regles-validation-store-v1",
  parties: [partie<RegleValidationRecord>({
    table: "regles_validation",
    colonnes: ["id", "filiereId", "filiere", "type", "validationParCredit", "validationParMoyenne", "creditPassage",
      "moyennePassage", "moyenneEliminatoire", "modifiePar", "modifieLe"],
    defauts: { filiere: "" },
    lire: getReglesValidation,
    remplacer: remplacerReglesValidation,
  })],
});

enregistrerMiroir({
  cle: "edumanage-reglements-calcul-v1",
  parties: [
    partie<ReglementCalcul>({
      table: "reglements_calcul",
      colonnes: ["id", "nom", "annee", "filiereIds", "formules", "creePar", "creeLe", "modifiePar", "modifieLe", "depuisVersion"],
      defauts: { formules: {}, creePar: "" },
      lire: getReglements,
      remplacer: remplacerReglements,
    }),
    partie<VersionReglement>({
      table: "reglements_calcul_versions",
      colonnes: ["id", "reglementId", "numero", "action", "nom", "annee", "filiereIds", "formules", "par", "le", "depuisVersion"],
      lire: getHistorique,
      remplacer: remplacerHistorique,
      lectureSeule: true,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-bulletin-methodes-store-v1",
  parties: [partie<MethodeCalculRecord>({
    table: "methodes_calcul",
    colonnes: ["id", "code", "intitule", "niveau", "description", "actif"],
    lire: getMethodesCalcul,
    remplacer: remplacerMethodesCalcul,
  })],
});

enregistrerMiroir({
  cle: "edumanage-mentions-store-v1",
  parties: [partie<MentionRecord>({
    table: "mentions",
    colonnes: ["id", "niveau", "valeurMin", "valeurMax", "mention", "appreciationSucces", "appreciationEchec", "actif"],
    lire: getMentions,
    remplacer: remplacerMentions,
  })],
});

enregistrerMiroir({
  cle: "edumanage-type-evaluation-store-v1",
  parties: [partie<TypeEvaluationRecord>({
    table: "types_evaluation",
    colonnes: ["id", "code", "intitule", "actif"],
    lire: getTypesEvaluation,
    remplacer: remplacerTypesEvaluation,
  })],
});

enregistrerMiroir({
  cle: "edumanage-regroupement-devoir-store-v1",
  parties: [partie<RegroupementDevoirRecord>({
    table: "regroupements_devoir",
    colonnes: ["id", "code", "intitule", "role", "typeEvaluationIds"],
    defauts: { typeEvaluationIds: [] },
    lire: getRegroupementsDevoir,
    remplacer: remplacerRegroupementsDevoir,
  })],
});

enregistrerMiroir({
  cle: "edumanage-declassement-parametre-store-v1",
  parties: [partie<DeclassementParametreRecord>({
    table: "declassement_parametres",
    colonnes: ["id", "filiereId", "filiere", "annee", "niveau", "niveauLabel", "typeEvaluationId", "typeEvaluationLabel", "nbNotesRequis"],
    defauts: { filiere: "", niveauLabel: "", typeEvaluationLabel: "" },
    lire: getDeclassementParametres,
    remplacer: remplacerDeclassementParametres,
  })],
});
