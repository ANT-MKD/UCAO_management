/** Prépare un établissement de test complet (installation, maquettes, une classe de L3, un
 * professeur, une étudiante) avec les vraies fonctions de l'application, et fournit des raccourcis
 * pour noter, facturer ou planifier. Utilisé par les tests de calcul (tests/unit). */
export const ANNEE_TEST = "2025-2026";
export const MOT_DE_PASSE_ADMIN = "Direction2026";

export async function preparerEtablissement() {
  const S = await import("@/data/studentStore");
  const admin = S.installerEtablissement({
    prenom: "Awa", nom: "Ndiaye", identifier: "ADM-TEST", email: "scolarite@test.sn", password: MOT_DE_PASSE_ADMIN,
    annee: { libelle: ANNEE_TEST, dateDebut: "2025-11-03", dateFin: "2026-07-31" },
  });
  const { genererDonneesAcademiques } = await import("./socleAcademique");
  genererDonneesAcademiques(admin.id);
  const St = await import("@/data/structureStore");
  const C = await import("@/data/curriculumStore");
  const N = await import("@/data/niveauStore");
  const Se = await import("@/data/semestreStore");
  const T = await import("@/data/teacherStore");
  const Ev = await import("@/data/evaluationStore");

  const classe = St.getClasses().find((c) => c.niveau === "L3" && C.getUes().some((u) => u.filiereId === c.filiereId && u.niveau === "L3"))!;
  const niveau = N.getNiveaux().find((n) => n.filiereId === classe.filiereId && n.alias === classe.niveau)!;
  const semestreDe = (alias: string) => Se.getSemestres().find((s) => s.niveauId === niveau.id && s.alias === alias)!;
  const uesDu = (alias: string) => C.getUes().filter((u) => u.filiereId === classe.filiereId && u.niveau === classe.niveau && u.semestre === alias);
  const ecsDe = (ueId: string) => C.getEcs().filter((e) => e.ueId === ueId);

  const prof = T.addTeacher({ prenom: "Mamadou", nom: "KANE", matricule: "ENS-TEST-1", telephone: "770000000", specialite: "QHSE", grade: "Vacataire", tauxHoraire: 10000, email: "kane@test.sn", sexe: "M" }, admin.id);

  function inscrire(prenom: string, nom: string) {
    return S.registerNewEtudiant(
      { prenom, nom, sexe: "F", dateNaissance: "2003-01-01", email: `${prenom.toLowerCase()}@test.sn`, filiereId: classe.filiereId, classeId: classe.id, niveau: classe.niveau, statut: "inscrit", annee: ANNEE_TEST, soldeDu: 0, inscriptionUniquePayee: true, motDePasse: "Provisoire1" },
      S.allocateMatricule(classe.filiere, ANNEE_TEST),
    );
  }

  /** Crée l'évaluation (rôle, poids) si besoin et y enregistre une note, puis la publie. */
  function noter(etudiantId: string, ecId: string, role: "devoir" | "examen", note: number, poids: number, session?: "rattrapage") {
    const ec = C.getEcs().find((e) => e.id === ecId)!;
    const ue = C.getUes().find((u) => u.id === ec.ueId)!;
    const sem = semestreDe(ue.semestre);
    let evaluation = Ev.getEvaluations().find((e) => e.classeId === classe.id && e.ecId === ecId && Ev.resolveRoleEvaluation(e) === role && e.session === session);
    if (!evaluation) {
      evaluation = Ev.createEvaluation({ filiereId: classe.filiereId, annee: ANNEE_TEST, niveauId: niveau.id, niveau: niveau.alias, classeId: classe.id, semestreId: sem.id, semestre: sem.alias, ecId, professeurId: prof.id, professeur: "Mamadou KANE", type: role, poids, session });
    }
    S.saveNoteEvaluationGrid(classe.id, ecId, ec.libelle, evaluation.id, role, session, [{ etudiantId, note }], false);
    S.submitNotesForValidation(classe.id, ecId, session);
    S.validateNotesByAdmin(classe.id, ecId, admin.id, session);
    S.publishNotesForClasseEc(classe.id, ecId, session);
  }

  return { S, St, C, admin, classe, niveau, prof, semestreDe, uesDu, ecsDe, inscrire, noter };
}
