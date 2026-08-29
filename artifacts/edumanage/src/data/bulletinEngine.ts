import { getUes, getEcs } from "./curriculumStore";
import { getEffectiveNote } from "./studentStore";
import { getPoidsForClasseEc } from "./evaluationStore";
import { getClasseById } from "./structureStore";

const POIDS_CC_DEFAUT = 30;
const POIDS_EXAMEN_DEFAUT = 70;

export interface EcMoyenne {
  id: string;
  code: string;
  libelle: string;
  credits: number;
  cc?: number;
  ef?: number;
  moyenne?: number;
  creditsObtenus: number;
  validee: boolean;
}

export interface UeMoyenne {
  id: string;
  code: string;
  libelle: string;
  credits: number;
  ecs: EcMoyenne[];
  moyenne?: number;
  creditsObtenus: number;
  validee: boolean;
}

export interface BulletinEtudiant {
  ues: UeMoyenne[];
  moyenneSession?: number;
  creditsObtenus: number;
  creditsTotal: number;
}

/** Moteur de calcul du bulletin réel d'un étudiant pour une classe et une session, à partir
 * des vraies UE/EC, des vraies notes (CC + meilleur EF disponible — rattrapage préféré à
 * l'examen normal via getEffectiveNote) et des vrais poids posés via Nouvelle évaluation
 * (repli 30/70 sinon). Source unique utilisée par Bulletin étudiants, Moyennes par promotion,
 * Délibérations et Relevés & Bulletins — jamais de moyenne fabriquée ou aléatoire. */
export function computeBulletin(
  etudiantId: string,
  classeId: string,
  filiereId: string,
  niveauAlias: string,
  semestreAlias: string,
): BulletinEtudiant {
  const uesSession = getUes().filter((u) => u.filiereId === filiereId && u.niveau === niveauAlias && u.semestre === semestreAlias);
  const ecsAll = getEcs();

  const ues: UeMoyenne[] = uesSession.map((ue): UeMoyenne => {
    const ecsUe = ecsAll.filter((ec) => ec.ueId === ue.id);
    const ecs: EcMoyenne[] = ecsUe.map((ec): EcMoyenne => {
      const cc = getEffectiveNote(etudiantId, classeId, ec.id, "CC")?.note;
      const ef = getEffectiveNote(etudiantId, classeId, ec.id, "EF")?.note;
      const { devoir, examen } = getPoidsForClasseEc(classeId, ec.id);
      const poidsCc = (devoir ?? POIDS_CC_DEFAUT) / 100;
      const poidsExamen = (examen ?? POIDS_EXAMEN_DEFAUT) / 100;
      const moyenne = cc !== undefined && ef !== undefined ? cc * poidsCc + ef * poidsExamen : undefined;
      const validee = moyenne !== undefined && moyenne >= 10;
      return { id: ec.id, code: ec.code, libelle: ec.libelle, credits: ec.credits, cc, ef, moyenne, creditsObtenus: validee ? ec.credits : 0, validee };
    });
    const ecsAvecMoyenne = ecs.filter((l) => l.moyenne !== undefined);
    const totalCreditsAvecMoyenne = ecsAvecMoyenne.reduce((s, l) => s + l.credits, 0);
    const moyenneUe = totalCreditsAvecMoyenne > 0
      ? ecsAvecMoyenne.reduce((s, l) => s + l.moyenne! * l.credits, 0) / totalCreditsAvecMoyenne
      : undefined;
    const valideeUe = moyenneUe !== undefined && moyenneUe >= 10;
    return { id: ue.id, code: ue.code, libelle: ue.libelle, credits: ue.credits, ecs, moyenne: moyenneUe, creditsObtenus: valideeUe ? ue.credits : 0, validee: valideeUe };
  });

  const uesAvecMoyenne = ues.filter((u) => u.moyenne !== undefined);
  const totalCreditsUeAvecMoyenne = uesAvecMoyenne.reduce((s, u) => s + u.credits, 0);
  const moyenneSession = totalCreditsUeAvecMoyenne > 0
    ? uesAvecMoyenne.reduce((s, u) => s + u.moyenne! * u.credits, 0) / totalCreditsUeAvecMoyenne
    : undefined;
  const creditsObtenus = ues.reduce((s, u) => s + u.creditsObtenus, 0);
  const creditsTotal = ues.reduce((s, u) => s + u.credits, 0);

  return { ues, moyenneSession, creditsObtenus, creditsTotal };
}

/** Variante pratique pour itérer tout le monde d'une classe : dérive filiereId/niveau de la
 * classe elle-même plutôt que de les faire fournir par l'appelant. */
export function computeBulletinPourClasse(etudiantId: string, classeId: string, semestreAlias: string): BulletinEtudiant | undefined {
  const classe = getClasseById(classeId);
  if (!classe) return undefined;
  return computeBulletin(etudiantId, classeId, classe.filiereId, classe.niveau, semestreAlias);
}
