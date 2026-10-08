import { expect, test } from "@playwright/test";
import { connecter, MDP_ADMIN, MDP_ETUDIANT, MDP_PROF, preparerDonnees } from "./outils";

test.describe("portail professeur", () => {
  test("note publiée : demande de correction → acceptée par la scolarité → visible par l'étudiante", async ({ page }) => {
    const d = await preparerDonnees(page);
    // Examen de Mamadou KANE noté 14 pour Awa SECK, validé et publié.
    const evaluationId = await page.evaluate(async (a) => {
      const S = await import("/src/data/studentStore.ts");
      const Ev = await import("/src/data/evaluationStore.ts");
      const St = await import("/src/data/structureStore.ts");
      const N = await import("/src/data/niveauStore.ts");
      const Se = await import("/src/data/semestreStore.ts");
      const C = await import("/src/data/curriculumStore.ts");
      const T = await import("/src/data/teacherStore.ts");
      const classe = St.getClasses().find((c) => c.id === a.classeId)!;
      const ue = C.getUes().find((u) => u.id === C.getEcs().find((e) => e.id === a.ecId)!.ueId)!;
      const niveau = N.getNiveaux().find((n) => n.filiereId === classe.filiereId && n.alias === classe.niveau)!;
      const sem = Se.getSemestres().find((s) => s.niveauId === niveau.id && s.alias === ue.semestre)!;
      const prof = T.getTeachers().find((t) => t.nom === "KANE")!;
      const admin = S.getUserAccounts().find((u) => u.identifier === "ADM-TEST")!;
      const ev = Ev.createEvaluation({ filiereId: classe.filiereId, annee: "2025-2026", niveauId: niveau.id, niveau: niveau.alias, classeId: classe.id, semestreId: sem.id, semestre: sem.alias, ecId: a.ecId, professeurId: prof.id, professeur: "Mamadou KANE", type: "examen", poids: 100 });
      S.saveNoteEvaluationGrid(classe.id, a.ecId, a.ecLibelle, ev.id, "examen", undefined, [{ etudiantId: a.etudiantId, note: 14 }], false);
      S.submitNotesForValidation(classe.id, a.ecId);
      S.validateNotesByAdmin(classe.id, a.ecId, admin.id);
      S.publishNotesForClasseEc(classe.id, a.ecId);
      return ev.id;
    }, d);

    await connecter(page, "PROF-KANE", MDP_PROF);
    await page.goto(`/teacher/grades?classeId=${d.classeId}&ecId=${d.ecId}`);
    await page.getByTestId("notes-evaluation").selectOption(evaluationId);
    const saisie = page.getByTestId(`notes-note-${d.etudiantId}`);
    await expect(saisie).toBeDisabled();
    await expect(saisie).toHaveValue(/^14/);
    await page.getByTestId(`notes-corriger-${d.etudiantId}`).click();
    await page.getByTestId("correction-note").fill("15,5");
    await page.getByTestId("correction-motif").fill("Erreur de report : 15,5 sur la copie");
    await page.getByTestId("correction-envoyer").click();
    await expect(page.getByTestId(`notes-correction-attente-${d.etudiantId}`)).toContainText("15,50");

    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/notes");
    const demandes = page.getByTestId("demandes-correction");
    await expect(demandes).toContainText("Awa SECK");
    await expect(demandes).toContainText("Erreur de report");
    await demandes.locator('[data-testid^="demande-correction-accepter-"]').click();
    await expect(demandes).toHaveCount(0);

    await connecter(page, d.matricule, MDP_ETUDIANT);
    await page.goto("/student/notes");
    await expect(page.locator("main")).toContainText("15,50");
    await page.goto("/student/notifications");
    await expect(page.locator("main")).toContainText("Note corrigée");
  });
});
