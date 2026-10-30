import { getEtudiants, getInscriptions, getSeances, getCahiers, getNotes, getNotesEvaluation, deleteNotesNonOfficiellesEvaluation, noteOfficielle, logAudit } from "./studentStore";
import { getClasses, getSalles, getClasseById, getSalleById, deleteClasse, deleteSalle } from "./structureStore";
import { getUes, getEcs, getUeById, getEcById, deleteUe, deleteEc } from "./curriculumStore";
import { getFiliereById, deleteFiliere } from "./filiereStore";
import { getNiveaux, deleteNiveau } from "./niveauStore";
import { getSemestres, deleteSemestre } from "./semestreStore";
import { getEvaluations, getEvaluationById, deleteEvaluation } from "./evaluationStore";
import { getDeliberations } from "./deliberationStore";
import { getDeliberationsAnnuelles } from "./deliberationAnnuelleStore";
import { getPointages } from "./pointageStore";

/** Suppressions du référentiel académique (filières, niveaux, semestres, classes, salles, UE, EC).
 * Un élément encore utilisé n'est jamais supprimé : ses étudiants, notes, séances ou jurys
 * resteraient rattachés à un élément disparu et les résultats changeraient sans décision de
 * personne (une UE supprimée en plein jury retire ses crédits du total du semestre). Le refus dit
 * ce qui utilise l'élément et propose de le désactiver à la place. */

export interface ResultatSuppression {
  ok: boolean;
  reason?: string;
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** « 4 étudiants, 9 séances » à partir des comptages non nuls. */
function liste(usages: [number, string, string][]): string {
  return usages.filter(([n]) => n > 0).map(([n, un, plusieurs]) => pluriel(n, un, plusieurs)).join(", ");
}

function refus(quoi: string, feminin: boolean, usages: [number, string, string][], conseil: string): ResultatSuppression | null {
  const texte = liste(usages);
  return texte ? { ok: false, reason: `Suppression impossible : ${quoi} est encore utilisé${feminin ? "e" : ""} (${texte}). ${conseil}` } : null;
}

function journal(par: string, cible: string, id: string, libelle: string) {
  logAudit(par, `suppression_${cible}`, cible, id, libelle);
}

// ── EC ──────────────────────────────────────────────────────────────────────

export function usagesEc(ecId: string): [number, string, string][] {
  return [
    [getNotes().filter((n) => n.ecId === ecId).length, "note", "notes"],
    [getEvaluations().filter((e) => e.ecId === ecId).length, "évaluation", "évaluations"],
    [getSeances().filter((s) => s.ecId === ecId).length, "séance d'emploi du temps", "séances d'emploi du temps"],
    [getCahiers().filter((c) => c.ecId === ecId).length, "cahier de séance", "cahiers de séance"],
    [getPointages().filter((p) => p.ecId === ecId).length, "pointage", "pointages"],
  ];
}

export function verifierSuppressionEc(ecId: string): ResultatSuppression {
  const ec = getEcById(ecId);
  if (!ec) return { ok: false, reason: "Élément constitutif introuvable." };
  return refus(`l'EC ${ec.code}`, false, usagesEc(ecId), "Il doit rester pour conserver les notes et l'historique des cours.") ?? { ok: true };
}

export function supprimerEc(ecId: string, par: string): ResultatSuppression {
  const v = verifierSuppressionEc(ecId);
  if (!v.ok) return v;
  const ec = getEcById(ecId)!;
  deleteEc(ecId);
  journal(par, "ec", ecId, `${ec.code} — ${ec.libelle}`);
  return { ok: true };
}

// ── UE ──────────────────────────────────────────────────────────────────────

export function verifierSuppressionUe(ueId: string): ResultatSuppression {
  const ue = getUeById(ueId);
  if (!ue) return { ok: false, reason: "Unité d'enseignement introuvable." };
  const ecs = getEcs().filter((e) => e.ueId === ueId);
  const total: [number, string, string][] = [[0, "note", "notes"], [0, "évaluation", "évaluations"], [0, "séance d'emploi du temps", "séances d'emploi du temps"], [0, "cahier de séance", "cahiers de séance"], [0, "pointage", "pointages"]];
  for (const ec of ecs) usagesEc(ec.id).forEach(([n], i) => { total[i][0] += n; });
  return refus(`l'UE ${ue.code}`, true, total, "Elle doit rester : ses notes comptent dans les résultats des étudiants.") ?? { ok: true };
}

/** Une UE inutilisée part avec ses EC (eux aussi inutilisés, puisque vérifiés avec elle). */
export function supprimerUe(ueId: string, par: string): ResultatSuppression {
  const v = verifierSuppressionUe(ueId);
  if (!v.ok) return v;
  const ue = getUeById(ueId)!;
  deleteUe(ueId);
  journal(par, "ue", ueId, `${ue.code} — ${ue.libelle}`);
  return { ok: true };
}

// ── Salle ───────────────────────────────────────────────────────────────────

export function verifierSuppressionSalle(salleId: string): ResultatSuppression {
  const salle = getSalleById(salleId);
  if (!salle) return { ok: false, reason: "Salle introuvable." };
  return refus(`la salle ${salle.nom}`, true, [
    [getSeances().filter((s) => s.salleId === salleId).length, "séance d'emploi du temps", "séances d'emploi du temps"],
    [getClasses().filter((c) => c.salleParDefautId === salleId).length, "classe (salle par défaut)", "classes (salle par défaut)"],
  ], "Passez-la plutôt en statut « Hors service » (bouton Modifier) : elle ne sera plus proposée.") ?? { ok: true };
}

export function supprimerSalle(salleId: string, par: string): ResultatSuppression {
  const v = verifierSuppressionSalle(salleId);
  if (!v.ok) return v;
  const salle = getSalleById(salleId)!;
  deleteSalle(salleId);
  journal(par, "salle", salleId, salle.nom);
  return { ok: true };
}

// ── Classe ──────────────────────────────────────────────────────────────────

export function verifierSuppressionClasse(classeId: string): ResultatSuppression {
  const classe = getClasseById(classeId);
  if (!classe) return { ok: false, reason: "Classe introuvable." };
  const etudiants = new Set([
    ...getEtudiants().filter((e) => e.classeId === classeId).map((e) => e.id),
    ...getInscriptions().filter((i) => i.classeId === classeId).map((i) => i.etudiantId),
  ]);
  return refus(`la classe ${classe.nom}`, true, [
    [etudiants.size, "étudiant inscrit", "étudiants inscrits"],
    [getSeances().filter((s) => s.classeId === classeId).length, "séance d'emploi du temps", "séances d'emploi du temps"],
    [getNotes().filter((n) => n.classeId === classeId).length, "note", "notes"],
    [getEvaluations().filter((e) => e.classeId === classeId).length, "évaluation", "évaluations"],
    [getDeliberations().filter((d) => d.classeId === classeId).length + getDeliberationsAnnuelles().filter((d) => d.classeId === classeId).length, "délibération", "délibérations"],
  ], "En fin d'année, clôturez-la plutôt (Scolarité › Classes › Clôture année).") ?? { ok: true };
}

export function supprimerClasse(classeId: string, par: string): ResultatSuppression {
  const v = verifierSuppressionClasse(classeId);
  if (!v.ok) return v;
  const classe = getClasseById(classeId)!;
  deleteClasse(classeId);
  journal(par, "classe", classeId, classe.nom);
  return { ok: true };
}

// ── Semestre ────────────────────────────────────────────────────────────────

export function verifierSuppressionSemestre(semestreId: string): ResultatSuppression {
  const semestre = getSemestres().find((s) => s.id === semestreId);
  if (!semestre) return { ok: false, reason: "Semestre introuvable." };
  const niveau = getNiveaux().find((n) => n.id === semestre.niveauId);
  const ues = niveau ? getUes().filter((u) => u.filiereId === niveau.filiereId && u.niveau === niveau.alias && u.semestre === semestre.alias) : [];
  return refus(`le semestre ${semestre.nom} (${semestre.alias})`, false, [
    [ues.length, "UE", "UE"],
    [getEvaluations().filter((e) => e.semestreId === semestreId).length, "évaluation", "évaluations"],
    [getDeliberations().filter((d) => d.semestreId === semestreId).length, "délibération", "délibérations"],
  ], "Passez-le plutôt en statut « Clôturé » (bouton Modifier).") ?? { ok: true };
}

export function supprimerSemestre(semestreId: string, par: string): ResultatSuppression {
  const v = verifierSuppressionSemestre(semestreId);
  if (!v.ok) return v;
  const semestre = getSemestres().find((s) => s.id === semestreId)!;
  deleteSemestre(semestreId);
  journal(par, "semestre", semestreId, `${semestre.nom} (${semestre.alias})`);
  return { ok: true };
}

// ── Niveau ──────────────────────────────────────────────────────────────────

export function verifierSuppressionNiveau(niveauId: string): ResultatSuppression {
  const niveau = getNiveaux().find((n) => n.id === niveauId);
  if (!niveau) return { ok: false, reason: "Niveau introuvable." };
  const dansLeNiveau = <T extends { filiereId: string; niveau: string }>(x: T) => x.filiereId === niveau.filiereId && x.niveau === niveau.alias;
  return refus(`le niveau ${niveau.nom} (${niveau.alias})`, false, [
    [getEtudiants().filter(dansLeNiveau).length, "étudiant", "étudiants"],
    [getClasses().filter(dansLeNiveau).length, "classe", "classes"],
    [getSemestres().filter((s) => s.niveauId === niveauId).length, "semestre", "semestres"],
    [getUes().filter(dansLeNiveau).length, "UE", "UE"],
  ], "Il doit rester tant que des classes ou des étudiants y sont rattachés.") ?? { ok: true };
}

export function supprimerNiveau(niveauId: string, par: string): ResultatSuppression {
  const v = verifierSuppressionNiveau(niveauId);
  if (!v.ok) return v;
  const niveau = getNiveaux().find((n) => n.id === niveauId)!;
  deleteNiveau(niveauId);
  journal(par, "niveau", niveauId, `${niveau.nom} (${niveau.alias})`);
  return { ok: true };
}

// ── Filière ─────────────────────────────────────────────────────────────────

export function verifierSuppressionFiliere(filiereId: string): ResultatSuppression {
  const filiere = getFiliereById(filiereId);
  if (!filiere) return { ok: false, reason: "Filière introuvable." };
  const etudiants = new Set([
    ...getEtudiants().filter((e) => e.filiereId === filiereId).map((e) => e.id),
    ...getInscriptions().filter((i) => i.filiereId === filiereId).map((i) => i.etudiantId),
  ]);
  return refus(`la filière ${filiere.nom}`, true, [
    [etudiants.size, "étudiant", "étudiants"],
    [getClasses().filter((c) => c.filiereId === filiereId).length, "classe", "classes"],
    [getNiveaux().filter((n) => n.filiereId === filiereId).length, "niveau", "niveaux"],
    [getUes().filter((u) => u.filiereId === filiereId).length, "UE", "UE"],
  ], "Passez-la plutôt en statut « Inactif » (bouton Modifier) : son historique est conservé.") ?? { ok: true };
}

export function supprimerFiliere(filiereId: string, par: string): ResultatSuppression {
  const v = verifierSuppressionFiliere(filiereId);
  if (!v.ok) return v;
  const filiere = getFiliereById(filiereId)!;
  deleteFiliere(filiereId);
  journal(par, "filiere", filiereId, `${filiere.code} — ${filiere.nom}`);
  return { ok: true };
}

// ── Évaluation ──────────────────────────────────────────────────────────────

/** Une évaluation dont des notes sont validées ou publiées ne se supprime pas : la note de la
 * matière disparaîtrait des bulletins. Les notes encore en brouillon partent avec elle. */
export function verifierSuppressionEvaluation(evaluationId: string): ResultatSuppression & { notesBrouillon?: number } {
  const ev = getEvaluationById(evaluationId);
  if (!ev) return { ok: false, reason: "Évaluation introuvable." };
  const notes = getNotesEvaluation(evaluationId);
  const officielles = notes.filter(noteOfficielle).length;
  if (officielles > 0) {
    return {
      ok: false,
      reason: `Suppression impossible : ${pluriel(officielles, "note de cette évaluation est validée ou publiée", "notes de cette évaluation sont validées ou publiées")}. La supprimer retirerait la note de la matière des bulletins. Corrigez plutôt les notes concernées (Scolarité › Notes › Notes étudiants).`,
    };
  }
  return { ok: true, notesBrouillon: notes.length };
}

export function supprimerEvaluation(evaluationId: string, par: string): ResultatSuppression {
  const v = verifierSuppressionEvaluation(evaluationId);
  if (!v.ok) return v;
  const ev = getEvaluationById(evaluationId)!;
  const retirees = deleteNotesNonOfficiellesEvaluation(evaluationId);
  deleteEvaluation(evaluationId);
  journal(par, "evaluation", evaluationId, `${ev.code} ${ev.type === "devoir" ? "Devoir" : "Examen"} — ${ev.cours}${retirees ? ` — ${pluriel(retirees, "note en brouillon retirée", "notes en brouillon retirées")}` : ""}`);
  return { ok: true };
}
