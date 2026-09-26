import { expect, test } from "@playwright/test";
import { viderNavigateur } from "./outils";

test("première ouverture : installation puis connexion du super administrateur", async ({ page }) => {
  await viderNavigateur(page);
  await expect(page.getByTestId("installation")).toBeVisible();
  await page.getByTestId("inst-prenom").fill("Awa");
  await page.getByTestId("inst-nom").fill("Ndiaye");
  await page.getByTestId("inst-identifiant").fill("adm-scolarite");
  await page.getByTestId("inst-email").fill("scolarite@ucao.sn");
  await page.getByTestId("inst-mdp").fill("Scolarite2026");
  await page.getByTestId("inst-mdp2").fill("Scolarite2026");
  await page.getByTestId("inst-annee").fill("2026-2027");
  await page.getByTestId("inst-debut").fill("2025-11-02");
  await page.getByTestId("inst-fin").fill("2027-07-31");
  await page.getByTestId("inst-valider").click();
  await expect(page.getByRole("alert")).toContainText("2026");
  await page.getByTestId("inst-debut").fill("2026-11-02");
  await page.getByTestId("inst-valider").click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByText("Bonjour, Awa")).toBeVisible();
  await expect(page.getByText("Nov 2026 – Jul 2027")).toBeVisible();

  // L'écran d'installation ne revient plus, et l'ancien compte de démonstration n'existe pas.
  await page.evaluate(async () => (await import("/src/data/studentStore.ts")).clearAuthSession());
  await page.goto("/login");
  await expect(page.getByTestId("installation")).toHaveCount(0);
  await page.getByTestId("input-email").fill("ADM-0001");
  await page.getByTestId("input-password").fill("demo123");
  await page.getByTestId("button-submit").click();
  await expect(page).toHaveURL(/\/login/);
});
