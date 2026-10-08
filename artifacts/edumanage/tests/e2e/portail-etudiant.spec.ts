import { expect, test } from "@playwright/test";
import { connecter, executer, MDP_ADMIN, MDP_ETUDIANT, preparerDonnees } from "./outils";

test.describe("portail étudiant", () => {
  test("pièce déposée → à vérifier par le secrétariat → refus motivé visible par l'étudiante", async ({ page }) => {
    const d = await preparerDonnees(page);
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await page.goto("/student/documents");
    await page.getByTestId("piece-deposer-extraitNaissance").click();
    await page.getByTestId("piece-fichier-input").setInputFiles({ name: "extrait.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 extrait") });
    await page.getByTestId("piece-deposer-confirmer").click();
    await expect(page.getByTestId("piece-etat-extraitNaissance")).toContainText("en cours de vérification");

    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/a-traiter");
    await page.getByTestId("a-traiter-pieces-etudiants").click();
    await page.getByTestId("dossier-piece-refuser-extraitNaissance").click();
    await page.getByTestId("dossier-piece-refus-motif").fill("Document illisible");
    await page.getByTestId("dossier-piece-refus-valider").click();
    await expect(page.getByTestId("dossier-piece-extraitNaissance")).toContainText("Document illisible");

    await connecter(page, d.matricule, MDP_ETUDIANT);
    await page.goto("/student/documents");
    await expect(page.getByTestId("piece-etat-extraitNaissance")).toContainText("Refusée — motif : Document illisible");
    await expect(page.getByTestId("piece-deposer-extraitNaissance")).toContainText("Redéposer");
  });

  test("cahier rejeté par l'administration : l'absence disparaît du portail", async ({ page }) => {
    const d = await preparerDonnees(page);
    await executer(page, `
      const c = S.submitCahierSeance({ seanceId: a.seanceId, prof: "Mamadou KANE", date: a.lundi, sujet: "Saisi pour la mauvaise classe", resume: "", presences: [{ etudiantId: a.etudiantId, nom: "Awa SECK", statut: "absent" }], etatSeance: "realisee" });
      const admin = S.getUserAccounts().find((u) => u.identifier === "ADM-TEST");
      S.validateCahier(c.id, admin.id, false);
    `, d);
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await page.goto("/student/absences");
    await expect(page.locator("main")).not.toContainText("Non justifiée");
    await page.goto("/student/cahier");
    await expect(page.locator("main")).not.toContainText("Saisi pour la mauvaise classe");
  });
});
