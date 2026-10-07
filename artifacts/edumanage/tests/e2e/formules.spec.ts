import { expect, test } from "@playwright/test";
import { connecter, MDP_ADMIN, preparerDonnees } from "./outils";

test.describe("formules de calcul", () => {
  test("une formule mal écrite est refusée, corrigée puis enregistrée pour la filière", async ({ page }) => {
    await preparerDonnees(page);
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/scolarite/formules");
    const enregistrer = page.getByTestId("formules-enregistrer");
    await expect(enregistrer).toBeDisabled();

    await page.getByTestId("formule-creditsUe").fill("SI(MOYENE_UE >= 10 ; CREDITS_UE ; 0)");
    await expect(page.getByTestId("formule-statut-creditsUe")).toContainText("Vouliez-vous dire MOYENNE_UE");
    await expect(enregistrer).toBeDisabled();

    await page.getByTestId("formule-creditsUe").fill("=SI(MOYENNE_UE>=10;CREDITS_UE;0)");
    await expect(page.getByTestId("formule-statut-creditsUe")).toContainText("Formule correcte");
    await expect(page.getByTestId("resultat-creditsUe")).toContainText("UE non acquise");
    await page.getByTestId("essai-creditsUe-MOYENNE_UE").fill("10");
    await expect(page.getByTestId("resultat-creditsUe")).toContainText("10 crédit(s) sur 10");

    await enregistrer.click();
    await expect(page.getByText(/Formules de .* enregistrées/)).toBeVisible();
    await page.goto("/admin/scolarite/parametrage");
    await expect(page.locator("table").first()).toContainText("1 formule(s)");
  });
});
