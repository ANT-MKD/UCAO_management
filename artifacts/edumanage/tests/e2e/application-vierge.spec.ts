import { expect, test } from "@playwright/test";
import { connecter, MDP_ADMIN, preparerDonnees, viderNavigateur } from "./outils";

test.describe("application vierge", () => {
  test("une installation neuve ne contient aucune donnée et n'affiche aucune fausse alerte", async ({ page }) => {
    await viderNavigateur(page);
    await page.getByTestId("inst-etab-nom").fill("Université Catholique de l'Afrique de l'Ouest");
    await page.getByTestId("inst-prenom").fill("Responsable");
    await page.getByTestId("inst-nom").fill("Scolarité");
    await page.getByTestId("inst-identifiant").fill("adm-scolarite");
    await page.getByTestId("inst-email").fill("scolarite@ucao.sn");
    await page.getByTestId("inst-mdp").fill("Scolarite2026");
    await page.getByTestId("inst-mdp2").fill("Scolarite2026");
    await page.getByTestId("inst-annee").fill("2026-2027");
    await page.getByTestId("inst-debut").fill("2026-11-02");
    await page.getByTestId("inst-fin").fill("2027-07-31");
    await page.getByTestId("inst-valider").click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    const main = page.locator("main");
    await expect(page.getByTestId("dashboard-paiements-vide")).toContainText("Aucun paiement enregistré");
    await expect(main).toContainText("Aucun encaissement ni paiement d'enseignant");
    for (const alerte of ["Voir la liste", "Décomptes non soldés", "Crédits dus aux étudiants", "0M"]) {
      await expect(main).not.toContainText(alerte);
    }

    // Aucun organisme de prise en charge saisi d'avance.
    await page.goto("/admin/organismes-pec");
    await expect(main).not.toContainText("APES");
    expect(await page.evaluate(async () => (await import("/src/data/organismePECStore.ts")).getOrganismesPEC().length)).toBe(0);
  });

  test("nouvelle vacation : le taux vient de la fiche de l'enseignant, sans valeur par défaut", async ({ page }) => {
    await preparerDonnees(page);
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/vacations/new");
    const taux = page.getByTestId("vacation-taux");
    await expect(taux).toHaveValue("");
    const enseignant = page.getByLabel("Enseignant *");
    await enseignant.selectOption((await enseignant.locator("option", { hasText: "Mamadou KANE" }).getAttribute("value"))!);
    await expect(taux).toHaveValue("10000");
    await expect(page.locator("main")).toContainText("Taux de sa fiche");
  });
});
