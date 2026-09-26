import { expect, test } from "@playwright/test";
import { connecter, executer, MDP_ADMIN, MDP_ETUDIANT, MDP_PROF, preparerDonnees } from "./outils";

test.describe("parcours entre les trois portails", () => {
  test("facture et encaissement → frais de l'étudiante et tableau de bord", async ({ page }) => {
    const d = await preparerDonnees(page);
    await executer(page, `
      const q = S.emettreQuittanceBrute({ etudiantId: a.etudiantId, date: "2025-11-05", dateLimite: "2025-12-10", lignes: [{ label: "Frais de scolarité — échéance 1", montant: 150000 }], reference: "FAC-E2E" });
      S.payerQuittance({ id: q.id, montant: 50000, moyen: "Espèces", reference: "CAISSE-1", date: new Date().toISOString().slice(0, 10) });
    `, d);
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await page.goto("/student/frais-impaye");
    await expect(page.locator("main")).toContainText(/100[\s  ]000/);
    await page.goto("/student/frais-paye");
    await expect(page.locator("main")).toContainText(/50[\s  ]000/);
  });

  test("emploi du temps, cahier et absence → portails étudiant et professeur", async ({ page }) => {
    const d = await preparerDonnees(page);
    await executer(page, `S.submitCahierSeance({ seanceId: a.seanceId, prof: "Mamadou KANE", date: a.lundi, sujet: "Introduction à la certification", resume: "Normes ISO", presences: [{ etudiantId: a.etudiantId, nom: "Awa SECK", statut: "absent" }], etatSeance: "realisee" });`, d);
    await connecter(page, "PROF-KANE", MDP_PROF);
    await page.goto("/teacher/schedule");
    await expect(page.locator("main")).toContainText(d.ecLibelle.slice(0, 20));
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await page.goto("/student/cahier");
    await expect(page.locator("main")).toContainText("Introduction à la certification");
    await page.goto("/student/absences");
    await expect(page.locator("main")).toContainText("Non justifiée");
  });

  test("justificatif d'absence avec pièce jointe → validé par l'administration → absence justifiée", async ({ page }) => {
    const d = await preparerDonnees(page);
    await executer(page, `S.submitCahierSeance({ seanceId: a.seanceId, prof: "Mamadou KANE", date: a.lundi, sujet: "Cours 1", resume: "", presences: [{ etudiantId: a.etudiantId, nom: "Awa SECK", statut: "absent" }], etatSeance: "realisee" });`, d);
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await page.goto("/student/absences");
    await page.locator('[data-testid^="absence-justifier-"]').first().click();
    await page.getByTestId("requete-message").fill("J'étais malade, certificat joint.");
    await page.getByTestId("requete-piece").setInputFiles({ name: "certificat.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 certificat") });
    await page.getByTestId("requete-envoyer").click();
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/requests");
    await page.getByText(/^Justificatif —/).first().click();
    await expect(page.getByTestId("requete-piece-jointe")).toContainText("certificat.pdf");
    await page.getByTestId("requete-valider").click();
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await page.goto("/student/absences");
    await expect(page.locator("main")).toContainText("Justifiée");
  });

  test("notes publiées → étudiante, avec lien de réclamation", async ({ page }) => {
    const d = await preparerDonnees(page);
    await page.evaluate(async (a) => {
      const { preparerEtablissement } = await import("/tests/fixtures/etablissement.ts");
      void preparerEtablissement;
      const S = await import("/src/data/studentStore.ts"); const Ev = await import("/src/data/evaluationStore.ts");
      const N = await import("/src/data/niveauStore.ts"); const Se = await import("/src/data/semestreStore.ts"); const St = await import("/src/data/structureStore.ts");
      const classe = St.getClasses().find((c) => c.id === a.classeId)!;
      const niv = N.getNiveaux().find((n) => n.filiereId === classe.filiereId && n.alias === classe.niveau)!;
      const sem = Se.getSemestres().find((s) => s.niveauId === niv.id && s.alias === "S5")!;
      const evl = Ev.createEvaluation({ filiereId: classe.filiereId, annee: classe.annee, niveauId: niv.id, niveau: niv.alias, classeId: classe.id, semestreId: sem.id, semestre: "S5", ecId: a.ecId, professeur: "Mamadou KANE", type: "devoir", poids: 40 });
      S.saveNoteEvaluationGrid(classe.id, a.ecId, a.ecLibelle, evl.id, "devoir", undefined, [{ etudiantId: a.etudiantId, note: 14 }], false);
      S.submitNotesForValidation(classe.id, a.ecId); S.validateNotesByAdmin(classe.id, a.ecId, "u-admin-1"); S.publishNotesForClasseEc(classe.id, a.ecId);
    }, d);
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await page.goto("/student/notes");
    await page.getByText("Par évaluations").click();
    await expect(page.locator("main")).toContainText("14/20");
    await expect(page.locator('[data-testid^="note-reclamer-"]').first()).toBeVisible();
  });
});

test.describe("contrôles d'accès", () => {
  test("un professeur n'ouvre pas le cahier d'un collègue", async ({ page }) => {
    const d = await preparerDonnees(page);
    const cahierId = await executer<string>(page, `
      const T = await import("/src/data/teacherStore.ts");
      const autre = T.addTeacher({ prenom: "Fatou", nom: "NDIAYE", matricule: "ENS-TEST-9", telephone: "770000009", specialite: "QHSE", grade: "Vacataire", tauxHoraire: 10000, email: "ndiaye@test.sn", sexe: "F" }, "u-admin-1");
      const c = S.creerCompteStaff({ role: "teacher", prenom: "Fatou", nom: "NDIAYE", identifier: "PROF-NDIAYE", email: "ndiaye@test.sn", password: "Provisoire1", linkedId: autre.id }, "u-admin-1");
      S.definirMotDePasseDefinitif(c.id, "Collegue2026");
      return S.submitCahierSeance({ seanceId: a.seanceId, prof: "Mamadou KANE", date: a.lundi, sujet: "Contenu de KANE", resume: "", presences: [], etatSeance: "realisee" }).id;
    `, d);
    await connecter(page, "PROF-NDIAYE", "Collegue2026");
    await page.goto(`/teacher/cahier/${cahierId}/edit`);
    await expect(page.locator("main")).toContainText("Cahier introuvable");
    await connecter(page, "PROF-KANE", MDP_PROF);
    await page.goto(`/teacher/cahier/${cahierId}/edit`);
    await expect(page.locator("main")).not.toContainText("Cahier introuvable");
  });

  test("une étudiante bloquée ne peut pas se connecter, puis le peut après déblocage", async ({ page }) => {
    const d = await preparerDonnees(page);
    await executer(page, `
      const Mb = await import("/src/data/motifBlocageStore.ts");
      const m = Mb.upsertMotifBlocage({ code: "IMPAYE", intitule: "Impayé de scolarité", actionsInterdites: ["portail_etudiant"] }, "u-admin-1");
      S.setEtudiantMotifBlocage(a.etudiantId, m.id, "u-admin-1");
    `, d);
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await expect(page.locator("body")).toContainText("Accès au portail bloqué");
    await expect(page).toHaveURL(/\/login/);
    await executer(page, `S.setEtudiantMotifBlocage(a.etudiantId, undefined, "u-admin-1");`, d);
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test("un portail n'est pas accessible avec le rôle d'un autre", async ({ page }) => {
    const d = await preparerDonnees(page);
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await page.goto("/admin/students");
    await expect(page).toHaveURL(/\/student\/dashboard/);
    await page.goto("/teacher/dashboard");
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });
});
