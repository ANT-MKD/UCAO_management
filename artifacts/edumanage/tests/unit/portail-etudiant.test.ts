import { describe, expect, it } from "vitest";
import { ANNEE_TEST, preparerEtablissement } from "../fixtures/etablissement";

/** Awa SECK en L3 avec toutes les notes du S5 publiées (12 à l'examen), et son compte étudiant. */
async function avecAwa() {
  const e = await preparerEtablissement();
  const awa = e.inscrire("Awa", "SECK");
  const compte = e.S.getUserAccounts().find((u) => u.linkedId === awa.id)!;
  return { ...e, awa, compte };
}

function noterTout(e: Awaited<ReturnType<typeof avecAwa>>, semestre: string, note: number) {
  for (const ue of e.uesDu(semestre)) for (const ec of e.ecsDe(ue.id)) e.noter(e.awa.id, ec.id, "examen", note, 100);
}

/** Un cahier de séance soumis pour la classe d'Awa, avec son statut de présence. */
function cahier(e: Awaited<ReturnType<typeof avecAwa>>, date: string, jour: number, statut: "present" | "absent" | "retard") {
  const ec = e.ecsDe(e.uesDu("S5")[0].id)[0];
  const salle = e.St.getSalles()[0];
  const { seance } = e.S.addSeance({ ecId: ec.id, classeId: e.classe.id, salleId: salle.id, prof: "Mamadou KANE", profId: e.prof.id, jour, semaineDu: "2026-01-12", heureDebut: "08:00", heureFin: "10:00", type: "CM" });
  return e.S.submitCahierSeance({
    seanceId: seance!.id, prof: "Mamadou KANE", date, sujet: "Cours", resume: "Résumé",
    presences: [{ etudiantId: e.awa.id, nom: "Awa SECK", statut, retardMinutes: statut === "retard" ? 15 : undefined }],
    etatSeance: "realisee",
  });
}

describe("résultats visibles par l'étudiante", () => {
  it("cache la décision du jury tant que la délibération n'est pas clôturée", async () => {
    const e = await avecAwa();
    noterTout(e, "S5", 12);
    const D = await import("@/data/deliberationStore");
    const Rv = await import("@/data/reglesValidationStore");
    const { resolveBulletin } = await import("@/pages/admin/RelevesPage");
    const { verifierEligibiliteReussite } = await import("@/data/attestationStore");
    const sem = e.semestreDe("S5");
    const d = D.chargerDeliberation({ filiereId: e.classe.filiereId, filiere: e.classe.filiere, annee: ANNEE_TEST, niveauAlias: "L3", niveauLabel: "Licence 3", classeId: e.classe.id, classe: e.classe.nom, semestreId: sem.id, semestreAlias: "S5", semestreLabel: "Semestre 5 (S5)", etudiants: [{ id: e.awa.id, prenom: "Awa", nom: "SECK", matricule: e.awa.matricule }], regle: Rv.getRegleValidation(e.classe.filiereId, "semestre")!, effectuePar: "Test" });
    const releve = e.S.getReleves().find((r) => r.etudiantId === e.awa.id && /S5/.test(r.semestre))!;

    const enCours = resolveBulletin(releve, e.S.getEtudiants())!;
    expect(enCours.decision).toBeUndefined();
    expect(enCours.decisionLabel).toBe("Délibération en cours");
    expect(enCours.appreciation).toBe("En attente de délibération");
    expect(enCours.rang).toBeUndefined();
    expect(verifierEligibiliteReussite(e.awa.id, e.classe.id, sem.id).motif).toMatch(/pas clôturée/);

    D.cloturerDeliberation(d.id);
    const cloture = resolveBulletin(releve, e.S.getEtudiants())!;
    expect(cloture.decision).toBe(d.lignes[0].decisionFinale);
    expect(cloture.decisionLabel).not.toBe("Délibération en cours");
    expect(cloture.rang).toBe(1);
  });

  it("le semestre en cours est le plus avancé qui a des notes (moyenne du tableau de bord)", async () => {
    const e = await avecAwa();
    noterTout(e, "S5", 12);
    noterTout(e, "S6", 14);
    const { semestresDeLEtudiant } = await import("@/lib/portailEtudiant");
    const { getUes, getEcs } = await import("@/data/curriculumStore");
    const { semestreParDefaut } = semestresDeLEtudiant(e.awa, getUes(), getEcs(), e.S.getNotes(), e.S.getSeances());
    expect(semestreParDefaut).toBe("S6");
    const { computeBulletin } = await import("@/data/bulletinEngine");
    expect(computeBulletin(e.awa.id, e.classe.id, e.classe.filiereId, "L3", semestreParDefaut).moyenneSession).toBeCloseTo(14, 9);
  });
});

describe("assiduité", () => {
  it("un retard compte comme une présence, un cahier rejeté ne compte plus", async () => {
    const e = await avecAwa();
    const A = await import("@/data/assiduiteEngine");
    cahier(e, "2026-01-12", 1, "present");
    cahier(e, "2026-01-13", 2, "retard");
    const faux = cahier(e, "2026-01-14", 3, "absent");
    expect(A.getTauxPresencePourEtudiant(e.awa.id)).toEqual({ present: 2, total: 3, pct: 67 });

    e.S.validateCahier(faux.id, e.admin.id, false);
    expect(A.getTauxPresencePourEtudiant(e.awa.id)).toEqual({ present: 2, total: 2, pct: 100 });
    expect(A.getAssiduiteRowsPourEtudiant(e.awa.id).map((r) => r.type)).toEqual(["retard"]);
  });
});

describe("démarches de l'étudiante", () => {
  it("refuse un second justificatif pour une absence déjà en cours de traitement", async () => {
    const e = await avecAwa();
    const abs = cahier(e, "2026-01-12", 1, "absent");
    const demande = { studentId: e.awa.id, type: "justificatif_absence" as const, subject: "Justificatif", message: "Certificat médical", absenceCahierId: abs.id };
    const premier = e.S.addStudentRequest(demande);
    expect(() => e.S.addStudentRequest(demande)).toThrow(/déjà en cours de traitement/);
    e.S.cancelStudentRequest(premier.id, e.awa.id);
    expect(() => e.S.addStudentRequest(demande)).not.toThrow();
  });

  it("une pièce déposée attend la vérification du secrétariat avant d'être fournie", async () => {
    const e = await avecAwa();
    const scan = "data:image/png;base64,iVBORw0KGgo=";
    e.S.deposerDocumentEtudiant(e.awa.id, "extraitNaissance", scan, e.compte.id, "Extrait de naissance");
    let awa = e.S.getEtudiantById(e.awa.id)!;
    expect(awa.documentsFournis ?? []).not.toContain("extraitNaissance");
    expect(awa.piecesEnVerification?.extraitNaissance?.dataUrl).toBe(scan);
    expect(e.S.getNotificationsByUser(e.admin.id).some((n) => /Pièce à vérifier : Awa SECK .* « Extrait de naissance »/.test(n.message))).toBe(true);

    expect(() => e.S.verifierPieceEtudiant(e.awa.id, "extraitNaissance", "refuser", e.admin.id, { motif: " " })).toThrow(/motif/);
    e.S.verifierPieceEtudiant(e.awa.id, "extraitNaissance", "refuser", e.admin.id, { motif: "Document illisible", libellePiece: "Extrait de naissance" });
    awa = e.S.getEtudiantById(e.awa.id)!;
    expect(awa.piecesRefusees?.extraitNaissance?.motif).toBe("Document illisible");
    expect(e.S.getNotificationsByUser(e.compte.id).some((n) => /refusée — motif : Document illisible/.test(n.message))).toBe(true);

    e.S.deposerDocumentEtudiant(e.awa.id, "extraitNaissance", scan, e.compte.id, "Extrait de naissance");
    e.S.verifierPieceEtudiant(e.awa.id, "extraitNaissance", "accepter", e.admin.id, { libellePiece: "Extrait de naissance" });
    awa = e.S.getEtudiantById(e.awa.id)!;
    expect(awa.documentsFournis).toContain("extraitNaissance");
    expect(awa.documentsFichiers?.extraitNaissance).toBe(scan);
    expect(awa.piecesRefusees?.extraitNaissance).toBeUndefined();
    expect(() => e.S.deposerDocumentEtudiant(e.awa.id, "extraitNaissance", scan, e.compte.id)).toThrow(/déjà comme fournie/);
  });

  it("profil : téléphone vérifié, mot de passe ni vide ni inchangé", async () => {
    const e = await avecAwa();
    expect(() => e.S.updateEtudiantInfos(e.awa.id, { telephone: "abc" }, e.compte.id)).toThrow(/téléphone invalide/);
    e.S.updateEtudiantInfos(e.awa.id, { telephone: "+221 77 123 45 67" }, e.compte.id);
    expect(e.S.getEtudiantById(e.awa.id)!.telephone).toBe("+221 77 123 45 67");
    expect(() => e.S.changeOwnPassword(e.compte.id, "Provisoire1", "      ")).toThrow(/au moins/);
    expect(() => e.S.changeOwnPassword(e.compte.id, "Provisoire1", "Provisoire1")).toThrow(/différent/);
    expect(e.S.changeOwnPassword(e.compte.id, "Provisoire1", "Etudiante2026")).toBe(true);
  });
});

describe("messagerie", () => {
  it("l'étudiante écrit à l'administration et aux professeurs de sa classe seulement", async () => {
    const e = await avecAwa();
    const T = await import("@/data/teacherStore");
    const compteKane = e.S.creerCompteStaff({ role: "teacher", prenom: "Mamadou", nom: "KANE", identifier: "PROF-KANE", email: "kane@test.sn", password: "Professeur2026", linkedId: e.prof.id }, e.admin.id);
    const autre = T.addTeacher({ prenom: "Ibrahima", nom: "FALL", matricule: "ENS-TEST-2", telephone: "770000001", specialite: "Droit", grade: "Vacataire", tauxHoraire: 10000, email: "fall@test.sn", sexe: "M" }, e.admin.id);
    const compteFall = e.S.creerCompteStaff({ role: "teacher", prenom: "Ibrahima", nom: "FALL", identifier: "PROF-FALL", email: "fall@test.sn", password: "Professeur2026", linkedId: autre.id }, e.admin.id);
    cahier(e, "2026-01-12", 1, "present"); // Mamadou KANE a un créneau dans la classe d'Awa

    const contacts = e.S.contactsMessagerieEtudiant(e.compte.id).map((u) => u.id);
    expect(contacts).toContain(e.admin.id);
    expect(contacts).toContain(compteKane.id);
    expect(contacts).not.toContain(compteFall.id);

    expect(() => e.S.sendMessage(e.compte.id, compteFall.id, "Question", "Bonjour")).toThrow(/professeurs de votre classe/);
    expect(() => e.S.sendMessage(e.compte.id, compteKane.id, "Question", "Bonjour")).not.toThrow();
    // Un professeur qui écrit le premier peut recevoir une réponse.
    e.S.sendMessage(compteFall.id, e.compte.id, "Conférence", "Vous êtes invitée.");
    expect(() => e.S.sendMessage(e.compte.id, compteFall.id, "Conférence", "Merci")).not.toThrow();
  });
});

describe("notifications", () => {
  it("regroupe les notes publiées tant que la notification n'est pas lue", async () => {
    const e = await avecAwa();
    noterTout(e, "S5", 12);
    const notes = () => e.S.getNotificationsByUser(e.compte.id).filter((n) => n.groupe === "notes-publiees");
    const nbNotes = e.S.getNotes().filter((n) => n.etudiantId === e.awa.id && n.statut === "publie").length;
    expect(nbNotes).toBeGreaterThan(1);
    expect(notes()).toHaveLength(1);
    expect(notes()[0].message).toMatch(new RegExp(`^${nbNotes} nouvelles notes publiées — dernière : `));

    e.S.markNotificationRead(notes()[0].id, e.compte.id);
    noterTout(e, "S6", 14);
    expect(notes().filter((n) => !n.read)).toHaveLength(1);
  });

  it("chaque notification ouvre la bonne page du portail", async () => {
    const { lienNotificationEtudiant } = await import("@/lib/notificationsEtudiant");
    expect(lienNotificationEtudiant("12 nouvelles notes publiées — dernière : Projet Tutoré")).toBe("/student/notes");
    expect(lienNotificationEtudiant("Votre relevé de notes Semestre 5 (S5) (2025-2026) est disponible")).toBe("/student/releves");
    expect(lienNotificationEtudiant("Emploi du temps : 11 nouveaux créneaux ajoutés — dernier : Système de Management Intégré")).toBe("/student/schedule");
    expect(lienNotificationEtudiant("Votre pièce « Extrait de naissance » a été refusée — motif : illisible.")).toBe("/student/documents");
    expect(lienNotificationEtudiant("Absence constatée en LQHSES5U3E2 le 12/01/2026")).toBe("/student/absences");
    expect(lienNotificationEtudiant("Votre accès au portail est bloqué")).toBeUndefined();
  });
});

describe("textes", () => {
  it("libellés lisibles : type de note, statut, téléphone", async () => {
    const { libelleTypeNote, statutEtudiant } = await import("@/lib/portailEtudiant");
    const { telephoneValide } = await import("@/lib/telephone");
    expect(libelleTypeNote("EF")).toBe("Examen");
    expect(libelleTypeNote("CC")).toBe("Contrôle continu");
    expect(libelleTypeNote("EF", "rattrapage")).toBe("Examen (rattrapage)");
    expect(statutEtudiant("inscrit").label).toBe("Inscrit");
    expect(statutEtudiant("preinscrit").label).toBe("Préinscrit");
    expect(telephoneValide("77 123 45 67")).toBe(true);
    expect(telephoneValide("+228 90 12 34 56")).toBe(true);
    expect(telephoneValide("abc")).toBe(false);
    expect(telephoneValide("123")).toBe(false);
    expect(telephoneValide("")).toBe(true);
  });
});
