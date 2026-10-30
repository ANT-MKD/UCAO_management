import { expect, test } from "@playwright/test";
import { connecter, executer, MDP_ADMIN, preparerDonnees } from "./outils";

test.describe("règlements de calcul", () => {
  test("formule refusée puis corrigée, comparaison des résultats, enregistrement pour l'année", async ({ page }) => {
    const d = await preparerDonnees(page);
    // Awa : une UE à 9,95 (non acquise avec la règle UCAO).
    await executer(page, `
      const Ev = await import("/src/data/evaluationStore.ts");
      const C = await import("/src/data/curriculumStore.ts");
      const ec = C.getEcs().find((x) => x.id === a.ecId);
      const ecs = C.getEcs().filter((x) => x.ueId === ec.ueId);
      const notes = [[14, 12], [8, 7]];
      ecs.forEach((x, i) => {
        const [devoir, examen] = notes[i] ?? [10, 10];
        for (const [role, note, poids] of [["devoir", devoir, 30], ["examen", examen, 70]]) {
          const ev = Ev.getEvaluations().find((v) => v.classeId === a.classeId && v.ecId === x.id && v.type === role)
            ?? Ev.createEvaluation({ filiereId: S.getEtudiantById(a.etudiantId).filiereId, annee: "2025-2026", niveauId: "", niveau: "L3", classeId: a.classeId, semestreId: "", semestre: "S5", ecId: x.id, professeurId: "", professeur: "", type: role, poids });
          S.saveNoteEvaluationGrid(a.classeId, x.id, x.libelle, ev.id, role, undefined, [{ etudiantId: a.etudiantId, note }], false);
        }
      });
    `, d);
    const filiereId = await executer<string>(page, "return S.getEtudiantById(a.etudiantId).filiereId;", d);
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/scolarite/formules");
    await expect(page.getByTestId("reglement-aucun")).toBeVisible();
    await page.getByTestId("reglement-nouveau").click();
    await page.getByTestId(`reglement-filiere-${filiereId}`).check();

    await page.getByTestId("formule-creditsUe").fill("SI(MOYENE_UE >= 9,5 ; CREDITS_UE ; 0)");
    await expect(page.getByTestId("formule-statut-creditsUe")).toContainText("Vouliez-vous dire MOYENNE_UE");
    await expect(page.getByTestId("reglement-motif")).toBeVisible();

    await page.getByTestId("formule-creditsUe").fill("=SI(MOYENNE_UE>=9,5;CREDITS_UE;0)");
    await expect(page.getByTestId("formule-statut-creditsUe")).toContainText("Formule correcte");
    await page.getByTestId("reglement-comparer").click();
    await expect(page.getByTestId("comparaison-resume")).toContainText("verraient leur résultat changer");
    await expect(page.getByTestId("comparaison-resultat")).toContainText("Awa SECK");

    await page.getByTestId("reglement-enregistrer").click();
    await expect(page.locator('[data-testid^="reglement-carte-"]')).toHaveCount(1);
    await page.goto("/admin/scolarite/parametrage");
    await expect(page.locator("table").first()).toContainText("Règlement 2025-2026");
  });

  test("historique : chaque modification crée une version et l'on peut revenir à une ancienne", async ({ page }) => {
    const d = await preparerDonnees(page);
    const filiereId = await executer<string>(page, "return S.getEtudiantById(a.etudiantId).filiereId;", d);
    await executer(page, `
      const R = await import("/src/data/reglementCalculStore.ts");
      R.enregistrerReglement({ nom: "Règlement LQHSE", annee: "2025-2026", filiereIds: [a], formules: { creditsUe: "SI(MOYENNE_UE >= 10 ; CREDITS_UE ; 0)" } }, undefined, "Awa NDIAYE");
    `, filiereId);
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/scolarite/formules");
    await expect(page.locator('[data-testid^="reglement-historique-"]')).toContainText("version 1");

    // Modification : seuil de l'UE à 9,5.
    await page.locator('[data-testid^="reglement-ouvrir-"]').click();
    await page.getByTestId("formule-creditsUe").fill("SI(MOYENNE_UE >= 9,5 ; CREDITS_UE ; 0)");
    await page.getByTestId("reglement-comparer").click();
    await page.getByTestId("reglement-enregistrer").click();
    await expect(page.locator('[data-testid^="reglement-historique-"]')).toContainText("version 2");

    await page.locator('[data-testid^="reglement-historique-"]').click();
    await expect(page.getByTestId("historique-version-2")).toContainText("En vigueur");
    await expect(page.getByTestId("historique-changements-2")).toContainText("MOYENNE_UE >= 10");
    await expect(page.getByTestId("historique-changements-2")).toContainText("MOYENNE_UE >= 9,5");
    await expect(page.getByTestId("historique-reprendre-2")).toHaveCount(0);

    // Retour à la version 1 : l'éditeur la rouvre, la comparaison reste obligatoire.
    await page.getByTestId("historique-reprendre-1").click();
    await expect(page.getByTestId("reglement-depuis-version")).toContainText("version 1");
    await expect(page.getByTestId("formule-creditsUe")).toHaveValue("SI(MOYENNE_UE >= 10 ; CREDITS_UE ; 0)");
    await page.getByTestId("reglement-comparer").click();
    await page.getByTestId("reglement-enregistrer").click();
    await page.locator('[data-testid^="reglement-historique-"]').click();
    await expect(page.getByTestId("historique-version-3")).toContainText("Retour en arrière");
    await expect(page.getByTestId("historique-changements-3")).toContainText("Retour au contenu de la version 1");
  });
});
