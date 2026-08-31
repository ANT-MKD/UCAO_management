import { getUes, getEcs } from "./curriculumStore";
import { getEffectiveNote } from "./studentStore";
import { getPoidsForClasseEc } from "./evaluationStore";
import { getClasseById } from "./structureStore";
import { estEcRetireePourEtudiant } from "./portefeuilleCoursStore";
import { getConfigForFiliere, resolveCodeMethodeCalcul } from "./scolariteConfigStore";
import { getInscriptionsByEtudiant } from "./studentStore";
import { NIVEAUX, SEMESTRES } from "./mockData";
import { appliquerMethodeCalcul, type ElementPondere } from "@/lib/bulletinCalculs";

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
 * (repli 30/70 sinon). La moyenne d'UE et la moyenne de session appliquent la méthode de calcul
 * configurée pour la filière (Paramétrage bulletin), avec repli sur la pondération par crédits
 * historique si rien n'est configuré. Source unique utilisée par Bulletin étudiants, Moyennes
 * par promotion, Délibérations et Relevés & Bulletins — jamais de moyenne fabriquée ou aléatoire. */
export function computeBulletin(
  etudiantId: string,
  classeId: string,
  filiereId: string,
  niveauAlias: string,
  semestreAlias: string,
): BulletinEtudiant {
  const config = getConfigForFiliere(filiereId);
  const codeMoyUe = resolveCodeMethodeCalcul(config, "moyenneUe");
  const codeMoySession = resolveCodeMethodeCalcul(config, "moyenneSession");

  const uesSession = getUes().filter((u) => u.filiereId === filiereId && u.niveau === niveauAlias && u.semestre === semestreAlias);
  const ecsAll = getEcs();

  const ues: UeMoyenne[] = uesSession.map((ue): UeMoyenne => {
    // Un EC retiré du portefeuille de l'étudiant (déjà validé par équivalence/transfert, etc.)
    // ne doit plus jamais compter ni rester "en attente" indéfiniment dans son bulletin.
    const ecsUe = ecsAll.filter((ec) => ec.ueId === ue.id && !estEcRetireePourEtudiant(etudiantId, classeId, ec.id));
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
    const elementsUe: ElementPondere[] = ecs
      .filter((l) => l.moyenne !== undefined)
      .map((l) => {
        const ec = ecsUe.find((e) => e.id === l.id);
        return { moyenne: l.moyenne!, coeff: ec?.coeff ?? l.credits, credits: l.credits };
      });
    const moyenneUe = appliquerMethodeCalcul("moyenneUe", codeMoyUe, elementsUe);
    const valideeUe = moyenneUe !== undefined && moyenneUe >= 10;
    return { id: ue.id, code: ue.code, libelle: ue.libelle, credits: ue.credits, ecs, moyenne: moyenneUe, creditsObtenus: valideeUe ? ue.credits : 0, validee: valideeUe };
  });

  const elementsSession: ElementPondere[] = ues
    .filter((u) => u.moyenne !== undefined)
    .map((u) => {
      const ueRecord = uesSession.find((ue) => ue.id === u.id);
      return { moyenne: u.moyenne!, coeff: ueRecord?.coeff ?? u.credits, credits: u.credits };
    });
  const moyenneSession = appliquerMethodeCalcul("moyenneSession", codeMoySession, elementsSession);
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

export interface MoyenneAnnuelle {
  moyenne?: number;
  creditsObtenus: number;
  creditsTotal: number;
}

/** Moyenne annuelle réelle : combine les bulletins des semestres du niveau (S1, S2...) selon la
 * méthode de calcul "Moy. année" configurée pour la filière, pondérée par les crédits structurels
 * de chaque semestre (aucun champ de coefficient de semestre n'existe dans le référentiel — les
 * crédits totaux du semestre en tiennent lieu). */
export function computeMoyenneAnnuelle(etudiantId: string, classeId: string, filiereId: string, niveauAlias: string): MoyenneAnnuelle {
  const config = getConfigForFiliere(filiereId);
  const codeMoyAnnee = resolveCodeMethodeCalcul(config, "moyenneAnnee");
  const niveau = NIVEAUX.find((n) => n.filiereId === filiereId && n.alias === niveauAlias);
  const semestres = niveau ? SEMESTRES.filter((s) => s.niveauId === niveau.id) : [];

  const bulletins = semestres.map((s) => computeBulletin(etudiantId, classeId, filiereId, niveauAlias, s.alias));
  const elements: ElementPondere[] = bulletins
    .filter((b) => b.moyenneSession !== undefined)
    .map((b) => ({ moyenne: b.moyenneSession!, coeff: b.creditsTotal, credits: b.creditsTotal }));

  const moyenne = appliquerMethodeCalcul("moyenneAnnee", codeMoyAnnee, elements);
  const creditsObtenus = bulletins.reduce((s, b) => s + b.creditsObtenus, 0);
  const creditsTotal = bulletins.reduce((s, b) => s + b.creditsTotal, 0);
  return { moyenne, creditsObtenus, creditsTotal };
}

export interface MoyenneProgramme {
  moyenne?: number;
  anneesRetenues: { annee: string; niveau: string; moyenne?: number }[];
}

/** Moyenne de programme réelle : combine la moyenne annuelle de chaque année distincte du
 * parcours de l'étudiant (une entrée par niveau, en ne retenant que sa dernière inscription en
 * cas de redoublement — donc jamais deux fois la même année), selon la méthode "Moy. programme"
 * configurée pour la filière. Repose sur l'historique réel des inscriptions (InscriptionRecord),
 * seule source qui trace les années précédentes d'un étudiant dans EduManage. */
export function computeMoyenneProgramme(etudiantId: string, filiereId: string): MoyenneProgramme {
  const config = getConfigForFiliere(filiereId);
  const codeMoyProgramme = resolveCodeMethodeCalcul(config, "moyenneProgramme");

  const inscriptions = getInscriptionsByEtudiant(etudiantId).filter((i) => i.filiereId === filiereId);
  const parNiveau = new Map<string, (typeof inscriptions)[number]>();
  for (const insc of inscriptions) {
    // La dernière inscription (année la plus récente) pour un niveau donné efface les tentatives
    // précédentes redoublées, en supposant l'ordre naturel d'ajout de l'historique.
    parNiveau.set(insc.niveau, insc);
  }
  const parcours = Array.from(parNiveau.values()).sort((a, b) => a.annee.localeCompare(b.annee));

  const anneesRetenues = parcours.map((insc) => {
    const moyAnnuelle = computeMoyenneAnnuelle(etudiantId, insc.classeId, filiereId, insc.niveau);
    return { annee: insc.annee, niveau: insc.niveau, moyenne: moyAnnuelle.moyenne, credits: moyAnnuelle.creditsTotal };
  });

  const elements: ElementPondere[] = anneesRetenues
    .filter((a) => a.moyenne !== undefined)
    .map((a) => ({ moyenne: a.moyenne!, coeff: 1, credits: a.credits }));
  const moyenne = appliquerMethodeCalcul("moyenneProgramme", codeMoyProgramme, elements);

  return { moyenne, anneesRetenues: anneesRetenues.map(({ annee, niveau, moyenne }) => ({ annee, niveau, moyenne })) };
}
