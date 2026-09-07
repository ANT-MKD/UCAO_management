import { getUes, getEcs } from "./curriculumStore";
import { getEvaluationsForClasseEc } from "./evaluationStore";
import { getNoteForEvaluation } from "./studentStore";
import { getTypesEvaluation, type TypeEvaluationRecord } from "./typeEvaluationStore";
import { getDeclassementParametresPour, type DeclassementParametreRecord } from "./declassementParametreStore";
import type { EvaluationRecord } from "./evaluationStore";

export interface RaisonDeclassement {
  ecId: string;
  ecLibelle: string;
  typeEvaluationLabel: string;
  nbNotesRequis: number;
  nbNotesReelles: number;
}

export interface EtudiantDeclasse {
  etudiantId: string;
  raisons: RaisonDeclassement[];
}

/** Une évaluation compte pour un paramètre si elle porte explicitement ce type d'évaluation du
 * catalogue, ou — si aucun type précis n'a été choisi à sa création (flux simple historique) —
 * si son type plat devoir/examen correspond au code par défaut du type recherché. */
function evaluationCorrespondAuType(ev: EvaluationRecord, typeEvaluationId: string, types: TypeEvaluationRecord[]): boolean {
  if (ev.typeEvaluationId) return ev.typeEvaluationId === typeEvaluationId;
  const type = types.find((t) => t.id === typeEvaluationId);
  if (!type) return false;
  return (ev.type === "devoir" && type.code === "DEVOIR") || (ev.type === "examen" && type.code === "EXAMEN");
}

/** Détecte si un étudiant doit être déclassé pour une filière/niveau/année/semestre : pour chaque
 * EC du cursus DE CE SEMESTRE (même filtre que computeBulletin — filiereId + niveau + semestre sur
 * l'UE) et chaque paramètre de déclassement configuré (Type devoir + Nbre notes requis), compte les
 * vraies notes de ce type déjà saisies pour cet étudiant sur cet EC — jamais un chiffre fabriqué,
 * jamais un fichier séparé qui ignore ce qui a été réellement noté. En dessous du seuil, l'EC et la
 * raison sont ajoutés à la liste ; retourne undefined si tout est conforme (ou si aucun paramètre
 * n'est configuré pour cette combinaison, auquel cas le déclassement ne s'applique simplement pas).
 * Scoper par semestre évite de déclasser un étudiant pour des EC d'un autre semestre du même
 * niveau, pas encore enseignées ni notées. */
export function detecterDeclassementEtudiant(
  etudiantId: string,
  classeId: string,
  filiereId: string,
  niveauAlias: string,
  annee: string,
  semestreAlias: string,
): EtudiantDeclasse | undefined {
  const parametres = getDeclassementParametresPour(filiereId, niveauAlias, annee);
  if (parametres.length === 0) return undefined;

  const types = getTypesEvaluation();
  const ecsDuCursus = getEcs().filter((ec) => {
    const ue = getUes().find((u) => u.id === ec.ueId);
    return !!ue && ue.filiereId === filiereId && ue.niveau === niveauAlias && ue.semestre === semestreAlias;
  });

  const raisons: RaisonDeclassement[] = [];
  for (const ec of ecsDuCursus) {
    const evaluations = getEvaluationsForClasseEc(classeId, ec.id);
    for (const param of parametres) {
      const evaluationsDuType = evaluations.filter((ev) => evaluationCorrespondAuType(ev, param.typeEvaluationId, types));
      // Un EC où aucune évaluation de ce type n'a même été programmée n'est pas un manquement de
      // l'étudiant (c'est un EC pas encore évalué de cette façon) — on ne le compte que si le
      // professeur a effectivement programmé au moins une évaluation de ce type sur cet EC.
      if (evaluationsDuType.length === 0) continue;
      const nbNotesReelles = evaluationsDuType.filter((ev) => getNoteForEvaluation(etudiantId, ev.id) !== undefined).length;
      if (nbNotesReelles < param.nbNotesRequis) {
        raisons.push({
          ecId: ec.id,
          ecLibelle: ec.libelle,
          typeEvaluationLabel: param.typeEvaluationLabel,
          nbNotesRequis: param.nbNotesRequis,
          nbNotesReelles,
        });
      }
    }
  }

  return raisons.length > 0 ? { etudiantId, raisons } : undefined;
}

export type { DeclassementParametreRecord };
