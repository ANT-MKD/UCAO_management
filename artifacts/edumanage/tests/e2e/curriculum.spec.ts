import { expect, test } from "@playwright/test";
import { connecter, MDP_ADMIN, preparerDonnees } from "./outils";

test.describe("création des UE et des EC", () => {
  test("UE : code proposé ; EC : UE et enseignant par recherche, code et abrégé proposés, contrôle des crédits", async ({ page }) => {
    await preparerDonnees(page);
    await connecter(page, "ADM-TEST", MDP_ADMIN);

    // EC depuis la liste des UE : UE parente déjà choisie, code proposé.
    await page.goto("/admin/ues");
    const bouton = page.locator('[data-testid^="ue-ajouter-ec-"]').first();
    await bouton.click();
    await expect(page.getByTestId("ec-code")).toHaveValue(/E\d+$/);

    // Recherche de l'UE parente au clavier.
    await page.getByTestId("ec-ue").click();
    await page.getByTestId("ec-ue").fill("certification");
    await expect(page.getByTestId("ec-ue-liste")).toContainText("Certification");
    await page.getByTestId("ec-ue").press("Enter");
    await expect(page.getByTestId("ec-code")).toHaveValue(/^LQHSES6U\dE3$/);

    await page.getByTestId("ec-libelle").fill("Système de Management Intégré");
    await expect(page.getByTestId("ec-abrege")).toHaveValue("SMI");
    await page.getByTestId("ec-credits").fill("50");
    await expect(page.getByTestId("ec-controle-credits")).toContainText("dépasse les crédits de l'UE");

    // Enseignant responsable par recherche (nom ou matricule).
    await page.getByTestId("ec-enseignant").click();
    await page.getByTestId("ec-enseignant").fill("kane");
    await page.getByTestId("ec-enseignant").press("Enter");
    await expect(page.getByTestId("ec-enseignant")).toHaveValue(/Mamadou KANE/);
    await expect(page.getByText("Coefficient")).toHaveCount(0);
  });
});
