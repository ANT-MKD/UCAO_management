import { getUes, getEcs } from "./curriculumStore";
import { getEffectiveNote, getNoteForEvaluation, getInscriptionsByEtudiant } from "./studentStore";
import { getPoidsForClasseEc, getEvaluationsForClasseEc, resolveRoleEvaluation, getRattrapageEvaluation, type EvaluationRecord } from "./evaluationStore";
import { getClasseById } from "./structureStore";
import { estEcRetireePourEtudiant } from "./portefeuilleCoursStore";
import { getConfigForFiliere, resolveCodeMethodeCalcul, reglesDeCalcul, type ReglesCalcul } from "./scolariteConfigStore";
import { NIVEAUX, SEMESTRES } from "./mockData";
import { appliquerMethodeCalcul, type ElementPondere } from "@/lib/bulletinCalculs";


/** Moyenne pondérée par le poids de chaque évaluation d'un même rôle (devoir ou examen) — la
 * généralisation naturelle du cas à une seule évaluation (qui redonne alors exactement sa note,
 * quel que soit son poids). Utilisée pour composer plusieurs devoirs/examens d'un même EC
 * (Regroupement type de devoir) en une seule note CC ou EF. */
function moyennePondereeEvaluations(elements: { note: number; poids: number }[]): number | undefined {
  if (elements.length === 0) return undefined;
  const totalPoids = elements.reduce((s, e) => s + e.poids, 0);
  if (totalPoids <= 0) return elements.reduce((s, e) => s + e.note, 0) / elements.length;
  return elements.reduce((s, e) => s + e.note * e.poids, 0) / totalPoids;
}

/** Résout la note composite CC (devoir) et EF (examen) d'un étudiant pour un EC : si aucune
 * évaluation n'a été planifiée (Nouvelle évaluation), retombe sur l'historique (une note CC, une
 * note EF, rattrapage préféré via getEffectiveNote). Dès qu'au moins une évaluation existe, chaque
 * évaluation compte pour de vrai — plusieurs devoirs (Regroupement type de devoir) se combinent
 * en une moyenne pondérée par leur poids au lieu de s'écraser les uns les autres. Le rattrapage,
 * quand il existe, remplace entièrement le(s) examen(s) normal(aux), comme avant. */
function resolveEcComposite(etudiantId: string, classeId: string, ecId: string, regles: ReglesCalcul): { cc?: number; ef?: number } {
  const evaluations = getEvaluationsForClasseEc(classeId, ecId);
  if (evaluations.length === 0) {
    return {
      cc: getEffectiveNote(etudiantId, classeId, ecId, "CC")?.note,
      ef: getEffectiveNote(etudiantId, classeId, ecId, "EF")?.note,
    };
  }

  const devoirEvals = evaluations.filter((e) => resolveRoleEvaluation(e) === "devoir");
  const examenEvals = evaluations.filter((e) => resolveRoleEvaluation(e) === "examen");

  function composite(evals: EvaluationRecord[], role: "devoir" | "examen"): number | undefined {
    const elements: { note: number; poids: number }[] = [];
    for (const ev of evals) {
      // Repli sur la note "à plat" (legacy) uniquement quand une seule évaluation de ce rôle
      // existe : au-delà, associer une note sans evaluationId à l'une plutôt qu'à l'autre serait
      // arbitraire, donc cette évaluation reste "non notée" tant qu'elle n'a pas sa propre note.
      const note = getNoteForEvaluation(etudiantId, ev.id)?.note
        ?? (evals.length === 1 ? getEffectiveNote(etudiantId, classeId, ecId, role === "devoir" ? "CC" : "EF")?.note : undefined);
      if (note !== undefined) elements.push({ note, poids: ev.poids });
    }
    return moyennePondereeEvaluations(elements);
  }

  // Le rattrapage (Rattrapage) remplace intégralement le(s) examen(s) normal(aux) du côté EF,
  // jamais en plus — getEffectiveNote("EF") préfère déjà le rattrapage sur l'examen normal.
  const rattrapage = getRattrapageEvaluation(classeId, ecId, evaluations[0].semestreId);
  const rattrapageNote = rattrapage ? getEffectiveNote(etudiantId, classeId, ecId, "EF") : undefined;
  const rattrapageActif = rattrapageNote?.session === "rattrapage";

  const cc = composite(devoirEvals, "devoir");
  const examenNormal = examenEvals.length > 0
    ? moyennePondereeEvaluations(examenEvals.map((ev) => ({ note: getNoteForEvaluation(etudiantId, ev.id)?.note, poids: ev.poids })).filter((x): x is { note: number; poids: number } => x.note !== undefined))
    : undefined;
  let ef = rattrapageActif ? rattrapageNote!.note : composite(examenEvals, "examen");
  if (rattrapageActif) {
    // Règle de rattrapage de la filière (Paramétrage scolarité → Règles de calcul).
    if (regles.regleRattrapage === "meilleure" && examenNormal !== undefined) ef = Math.max(rattrapageNote!.note, examenNormal);
    if (regles.regleRattrapage === "plafonnee") ef = Math.min(rattrapageNote!.note, regles.plafondRattrapage);
  }

  return { cc, ef };
}

/** Poids global du côté devoir et du côté examen pour un EC : somme des poids de toutes les
 * évaluations de chaque rôle (au lieu du poids d'une seule, historique) — dans le cas courant à
 * une évaluation par rôle, c'est exactement son poids, donc identique à avant. */
function resolvePoidsRoles(classeId: string, ecId: string): { poidsDevoir?: number; poidsExamen?: number; examenSeul?: boolean } {
  const evaluations = getEvaluationsForClasseEc(classeId, ecId);
  if (evaluations.length === 0) {
    const { devoir, examen } = getPoidsForClasseEc(classeId, ecId);
    return { poidsDevoir: devoir, poidsExamen: examen };
  }
  const sommePoids = (evals: EvaluationRecord[]) => (evals.length > 0 ? evals.reduce((s, e) => s + e.poids, 0) : undefined);
  const poidsDevoir = sommePoids(evaluations.filter((e) => resolveRoleEvaluation(e) === "devoir"));
  const poidsExamen = sommePoids(evaluations.filter((e) => resolveRoleEvaluation(e) === "examen"));
  // EC évalué uniquement par examen : l'examen compte pour 100 %. L'inverse (devoirs sans examen)
  // reste « en attente » — c'est le cas normal d'un examen pas encore planifié.
  return { poidsDevoir, poidsExamen, examenSeul: poidsDevoir === undefined && poidsExamen !== undefined };
}

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
  /** UE non validée en elle-même, mais dont les crédits sont acquis par compensation du semestre. */
  valideeParCompensation?: boolean;
}

export interface BulletinEtudiant {
  ues: UeMoyenne[];
  moyenneSession?: number;
  creditsObtenus: number;
  creditsTotal: number;
  /** Moyenne de passage de la filière (Paramétrage scolarité) — seuil d'affichage « admis ». */
  moyennePassage: number;
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
  const regles = reglesDeCalcul(filiereId);
  const codeMoyUe = resolveCodeMethodeCalcul(config, "moyenneUe");
  const codeMoySession = resolveCodeMethodeCalcul(config, "moyenneSession");

  const uesSession = getUes().filter((u) => u.filiereId === filiereId && u.niveau === niveauAlias && u.semestre === semestreAlias);
  const ecsAll = getEcs();

  const ues: UeMoyenne[] = uesSession.map((ue): UeMoyenne => {
    // Un EC retiré du portefeuille de l'étudiant (déjà validé par équivalence/transfert, etc.)
    // ne doit plus jamais compter ni rester "en attente" indéfiniment dans son bulletin.
    const ecsUe = ecsAll.filter((ec) => ec.ueId === ue.id && !estEcRetireePourEtudiant(etudiantId, classeId, ec.id));
    const ecs: EcMoyenne[] = ecsUe.map((ec): EcMoyenne => {
      const { cc, ef } = resolveEcComposite(etudiantId, classeId, ec.id, regles);
      const { poidsDevoir: devoir, poidsExamen: examen, examenSeul } = resolvePoidsRoles(classeId, ec.id);
      const poidsCc = (devoir ?? regles.poidsDevoirDefaut) / 100;
      const poidsExamen = (examen ?? 100 - regles.poidsDevoirDefaut) / 100;
      const moyenne = examenSeul ? ef : cc !== undefined && ef !== undefined ? cc * poidsCc + ef * poidsExamen : undefined;
      const validee = moyenne !== undefined && moyenne >= regles.seuilValidationEc;
      return { id: ec.id, code: ec.code, libelle: ec.libelle, credits: ec.credits, cc, ef, moyenne, creditsObtenus: validee ? ec.credits : 0, validee };
    });
    const elementsUe: ElementPondere[] = ecs
      .filter((l) => l.moyenne !== undefined)
      .map((l) => {
        const ec = ecsUe.find((e) => e.id === l.id);
        return { moyenne: l.moyenne!, coeff: ec?.coeff ?? l.credits, credits: l.credits };
      });
    const moyenneUe = appliquerMethodeCalcul("moyenneUe", codeMoyUe, elementsUe);
    // Note plancher : un EC en dessous empêche la compensation au sein de l'UE.
    const sousPlancher = regles.noteEliminatoireEc > 0 && ecs.some((l) => l.moyenne !== undefined && l.moyenne < regles.noteEliminatoireEc);
    const valideeUe = moyenneUe !== undefined && moyenneUe >= regles.seuilValidationUe && !sousPlancher;
    return { id: ue.id, code: ue.code, libelle: ue.libelle, credits: ue.credits, ecs, moyenne: moyenneUe, creditsObtenus: valideeUe ? ue.credits : 0, validee: valideeUe };
  });

  const elementsSession: ElementPondere[] = ues
    .filter((u) => u.moyenne !== undefined)
    .map((u) => {
      const ueRecord = uesSession.find((ue) => ue.id === u.id);
      return { moyenne: u.moyenne!, coeff: ueRecord?.coeff ?? u.credits, credits: u.credits };
    });
  const moyenneSession = appliquerMethodeCalcul("moyenneSession", codeMoySession, elementsSession);
  const creditsTotal = ues.reduce((s, u) => s + u.credits, 0);

  // Compensation entre UE : semestre complet, moyenne ≥ moyenne de passage et aucune note sous le
  // plancher → tous les crédits du semestre sont acquis (si la filière l'a choisi).
  const toutesNotees = ues.length > 0 && ues.every((u) => u.ecs.every((l) => l.moyenne !== undefined));
  const aucunSousPlancher = regles.noteEliminatoireEc <= 0 || ues.every((u) => u.ecs.every((l) => l.moyenne === undefined || l.moyenne >= regles.noteEliminatoireEc));
  const valideParCompensation = regles.creditsParCompensation && toutesNotees && aucunSousPlancher
    && moyenneSession !== undefined && moyenneSession >= (config?.moyennePassage ?? 10);
  const uesFinales = valideParCompensation
    ? ues.map((u) => (u.validee ? u : { ...u, creditsObtenus: u.credits, valideeParCompensation: true }))
    : ues;
  const creditsObtenus = uesFinales.reduce((s, u) => s + u.creditsObtenus, 0);

  return { ues: uesFinales, moyenneSession, creditsObtenus, creditsTotal, moyennePassage: config?.moyennePassage ?? 10 };
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

export interface CreditsCumulesParcours {
  creditsObtenus: number;
  creditsTotal: number;
  detail: { annee: string; niveau: string; creditsObtenus: number; creditsTotal: number }[];
}

/** Crédits cumulés réels d'un étudiant sur tout son parcours dans une filière (une entrée par
 * niveau, dernière inscription retenue en cas de redoublement) — utilisé par le garde-fou
 * d'entrée de niveau (NiveauRecord.creditsRequisEntree, ex. 120 crédits requis pour L3) et par la
 * fiche étudiant. Repose sur le même historique d'inscriptions que computeMoyenneProgramme, mais
 * cumule les crédits obtenus plutôt qu'une moyenne pondérée. */
export function computeCreditsCumulesParcours(etudiantId: string, filiereId: string): CreditsCumulesParcours {
  const inscriptions = getInscriptionsByEtudiant(etudiantId).filter((i) => i.filiereId === filiereId);
  const parNiveau = new Map<string, (typeof inscriptions)[number]>();
  for (const insc of inscriptions) {
    parNiveau.set(insc.niveau, insc);
  }
  const detail = Array.from(parNiveau.values()).map((insc) => {
    const moyAnnuelle = computeMoyenneAnnuelle(etudiantId, insc.classeId, filiereId, insc.niveau);
    return { annee: insc.annee, niveau: insc.niveau, creditsObtenus: moyAnnuelle.creditsObtenus, creditsTotal: moyAnnuelle.creditsTotal };
  });
  return {
    creditsObtenus: detail.reduce((s, d) => s + d.creditsObtenus, 0),
    creditsTotal: detail.reduce((s, d) => s + d.creditsTotal, 0),
    detail,
  };
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
