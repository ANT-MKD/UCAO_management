import { getConfigForFiliere, reglesDeCalcul, resolveCodeMethodeCalcul } from "./scolariteConfigStore";
import { getRegleValidation } from "./reglesValidationStore";
import type { CleFormule } from "./formulesCalcul";

const n = (x: number) => String(x).replace(".", ",");

/** Ce que fait aujourd'hui chaque étape avec les réglages de la filière, écrit sous forme de
 * formule — affiché dans l'écran Formules de calcul et proposé comme point de départ (« Partir de
 * la règle actuelle »). Quand une méthode n'a pas d'équivalent en formule, on renvoie undefined
 * et l'écran affiche seulement sa description. */
export function formuleEquivalente(cle: CleFormule, filiereId: string): string | undefined {
  const regles = reglesDeCalcul(filiereId);
  const config = getConfigForFiliere(filiereId);
  switch (cle) {
    case "noteEc":
      return "= DEVOIR × POIDS_DEVOIR + EXAMEN_RETENU × POIDS_EXAMEN";
    case "moyenneUe": {
      const code = resolveCodeMethodeCalcul(config, "moyenneUe");
      if (code === "calculMoyenneDefault") return "= MOYENNE(MATIERES)";
      if (code === "calculMoyenneCredit") return "= MOYENNE_PONDEREE(MATIERES ; CREDITS_MATIERES)";
      return undefined;
    }
    case "creditsUe": {
      const conditions = [`MOYENNE_UE >= ${n(regles.seuilValidationUe)}`];
      if (regles.noteEliminatoireEc > 0) conditions.push(`NOTE_MIN >= ${n(regles.noteEliminatoireEc)}`);
      return conditions.length === 1
        ? `= SI(${conditions[0]} ; CREDITS_UE ; 0)`
        : `= SI(ET(${conditions.join(" ; ")}) ; CREDITS_UE ; 0)`;
    }
    case "moyenneSemestre": {
      const code = resolveCodeMethodeCalcul(config, "moyenneSession");
      if (code === "calculMoyenneEcSemestre") return "= MOYENNE(MATIERES_SEMESTRE)";
      if (code === "calculMoyenneDefault") return "= MOYENNE(UES)";
      if (code === "calculMoyenneCredit") return "= MOYENNE_PONDEREE(UES ; CREDITS_UES)";
      return undefined;
    }
    case "decisionSemestre": {
      const regle = getRegleValidation(filiereId, "semestre");
      if (!regle) return undefined;
      const conditions: string[] = [];
      if (regle.validationParCredit) conditions.push(`CREDITS_SEMESTRE >= ${regle.creditPassage}`);
      if (regle.validationParMoyenne) conditions.push(`MOYENNE_SEMESTRE >= ${n(regle.moyennePassage)}`);
      const condition = conditions.length === 0 ? "VRAI" : conditions.length === 1 ? conditions[0] : `ET(${conditions.join(" ; ")})`;
      const sinon = regle.validationParMoyenne && regles.margeRattrapage > 0
        ? `SI(MOYENNE_SEMESTRE >= ${n(regle.moyennePassage - regles.margeRattrapage)} ; "RATTRAPAGE" ; "NON VALIDÉ")`
        : `"NON VALIDÉ"`;
      let f = `SI(${condition} ; "VALIDÉ" ; ${sinon})`;
      if (regle.moyenneEliminatoire > 0) f = `SI(MOYENNE_SEMESTRE < ${n(regle.moyenneEliminatoire)} ; "EXCLU" ; ${f})`;
      if (regles.heuresAbsenceExclusion > 0) f = `SI(ABSENCES > ${n(regles.heuresAbsenceExclusion)} ; "EXCLU" ; ${f})`;
      return `= ${f}`;
    }
    case "decisionAnnee": {
      const regle = getRegleValidation(filiereId, "annee");
      if (!regle) return undefined;
      const credits = regle.validationParCredit ? regle.creditPassage : 0;
      const admis = regle.validationParMoyenne
        ? `ET(CREDITS_ANNEE >= ${credits} ; MOYENNE(MOYENNE_S1 ; MOYENNE_S2) >= ${n(regle.moyennePassage)})`
        : `CREDITS_ANNEE >= ${credits}`;
      const dette = regles.creditsPassageAvecDette;
      const sinon = dette > 0 ? `SI(CREDITS_ANNEE >= ${dette} ; "ADMIS AVEC DETTE" ; "REDOUBLE")` : `"REDOUBLE"`;
      let f = `SI(${admis} ; "ADMIS" ; ${sinon})`;
      if (regles.heuresAbsenceExclusion > 0) f = `SI(ABSENCES > ${n(regles.heuresAbsenceExclusion)} ; "EXCLU" ; ${f})`;
      return `= ${f}`;
    }
  }
}
