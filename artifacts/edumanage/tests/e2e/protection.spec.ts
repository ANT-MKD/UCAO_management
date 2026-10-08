import { expect, test } from "@playwright/test";
import { connecter, MDP_ADMIN, preparerDonnees } from "./outils";

test.describe("protection des données", () => {
  test("UE utilisée : suppression refusée avec la raison ; note publiée : motif obligatoire et trace au journal", async ({ page }) => {
    const d = await preparerDonnees(page);
    // Examen publié (12,6) pour Awa dans l'EC qui porte déjà une séance d'emploi du temps.
    const ueId = await page.evaluate(async ({ etudiantId, ecId, classeId }) => {
      const S = await import("/src/data/studentStore.ts");
      const Ev = await import("/src/data/evaluationStore.ts");
      const C = await import("/src/data/curriculumStore.ts");
      const St = await import("/src/data/structureStore.ts");
      const N = await import("/src/data/niveauStore.ts");
      const Se = await import("/src/data/semestreStore.ts");
      const ec = C.getEcs().find((e) => e.id === ecId)!;
      const ue = C.getUes().find((u) => u.id === ec.ueId)!;
      const classe = St.getClasses().find((c) => c.id === classeId)!;
      const niveau = N.getNiveaux().find((n) => n.filiereId === classe.filiereId && n.alias === classe.niveau)!;
      const sem = Se.getSemestres().find((s) => s.niveauId === niveau.id && s.alias === ue.semestre)!;
      const admin = S.getUserAccounts().find((u) => u.identifier === "ADM-TEST")!;
      const examen = Ev.createEvaluation({ filiereId: classe.filiereId, annee: classe.annee, niveauId: niveau.id, niveau: niveau.alias, classeId, semestreId: sem.id, semestre: sem.alias, ecId, professeurId: "", professeur: "Mamadou KANE", type: "examen", poids: 60 });
      S.saveNoteEvaluationGrid(classeId, ecId, ec.libelle, examen.id, "examen", undefined, [{ etudiantId, note: 12.6 }], false);
      S.submitNotesForValidation(classeId, ecId);
      S.validateNotesByAdmin(classeId, ecId, admin.id);
      S.publishNotesForClasseEc(classeId, ecId);
      return ue.id;
    }, d);
    await connecter(page, "ADM-TEST", MDP_ADMIN);

    // L'UE porte une note et une séance : refus expliqué, rien n'est supprimé.
    await page.goto("/admin/ues");
    let confirmations = 0;
    page.on("dialog", (dlg) => { confirmations++; void dlg.accept(); });
    await page.getByTestId(`ue-supprimer-${ueId}`).click();
    await expect(page.locator("[data-sonner-toast]")).toContainText(/Suppression impossible : l'UE .+ est encore utilisée \(1 note, 1 évaluation, 1 séance d'emploi du temps\)/);
    expect(confirmations).toBe(0);
    await expect(page.getByTestId(`ue-supprimer-${ueId}`)).toBeVisible();

    // La note publiée ne part qu'avec un motif, inscrit au journal avec l'ancienne valeur.
    await page.goto("/admin/notes/etudiant");
    await page.getByTestId("note-etudiant-recherche").fill("SECK");
    await page.getByTestId(`note-etudiant-suggestion-${d.etudiantId}`).click();
    await page.locator('[data-testid^="note-etudiant-supprimer-"]').first().click();
    await expect(page.getByTestId("note-suppression-modal")).toContainText("12.60 (publiée)");
    await expect(page.getByTestId("note-suppression-confirmer")).toBeDisabled();
    await page.getByTestId("note-suppression-motif").fill("Note saisie pour la mauvaise étudiante");
    await page.getByTestId("note-suppression-confirmer").click();
    await expect(page.getByText("Aucune note enregistrée pour cet étudiant")).toBeVisible();
    const trace = await page.evaluate(async () => (await import("/src/data/studentStore.ts")).getAuditLogs().find((l) => l.action === "suppression_note")?.meta);
    expect(trace).toMatch(/Awa SECK .*Examen : 12,6 \(publiée\) — motif : Note saisie pour la mauvaise étudiante/);
  });

  test("réinitialisation : réservée à l'accès complet, mot de passe exigé", async ({ page }) => {
    await preparerDonnees(page);
    await page.evaluate(async () => {
      const S = await import("/src/data/studentStore.ts");
      const admin = S.getUserAccounts().find((u) => u.identifier === "ADM-TEST")!;
      const c = S.creerCompteStaff({ role: "admin", prenom: "Binta", nom: "SOW", identifier: "SEC-SOW", email: "sow@test.sn", password: "Provisoire1", roleId: "role-direction" }, admin.id);
      S.definirMotDePasseDefinitif(c.id, "Direction2027");
    });

    // ROLE_DIRECTION voit toutes les pages, mais pas le bouton de réinitialisation.
    await connecter(page, "SEC-SOW", "Direction2027");
    await page.goto("/admin/security/reinitialisation-donnees");
    await expect(page.getByTestId("reset-reserve")).toBeVisible();
    await expect(page.getByTestId("button-confirmer-reset")).toHaveCount(0);

    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/security/reinitialisation-donnees");
    await page.getByTestId("input-confirmation-reset").fill("REINITIALISER");
    await expect(page.getByTestId("button-confirmer-reset")).toBeDisabled();
    await page.getByTestId("input-mot-de-passe-reset").fill("mauvais");
    await page.getByTestId("button-confirmer-reset").click();
    await expect(page.getByTestId("reset-erreur")).toHaveText("Mot de passe incorrect.");
    const etudiants = await page.evaluate(async () => (await import("/src/data/studentStore.ts")).getEtudiants().length);
    expect(etudiants).toBe(1);
  });
});
