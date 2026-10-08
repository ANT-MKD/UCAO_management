import { expect, test } from "@playwright/test";
import { connecter, MDP_ADMIN, preparerDonnees } from "./outils";

test.describe("accessibilité et textes", () => {
  test("champs trouvés par leur intitulé, boutons-icônes nommés, tableau au clavier", async ({ page }) => {
    await preparerDonnees(page);
    await connecter(page, "ADM-TEST", MDP_ADMIN);

    // Chaque intitulé désigne son champ : on remplit le formulaire comme un lecteur d'écran.
    await page.goto("/admin/salles/new");
    await page.getByLabel("Nom / code de la salle *").fill("Amphi B");
    await page.getByLabel("Capacité *").fill("0");
    await page.getByRole("button", { name: /Enregistrer|Créer/ }).last().click();
    await expect(page.getByText("Au moins 1 place")).toBeVisible();

    // Les boutons-icônes des tableaux ont un nom ; la pagination aussi.
    await page.goto("/admin/ues");
    await expect(page.getByRole("button", { name: "Modifier" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Supprimer l'UE / }).first()).toBeVisible();
    await expect(page.getByRole("searchbox").first()).toHaveAccessibleName(/.+/);

    // Ligne de tableau ouvrable au clavier.
    await page.goto("/admin/roles");
    const ligne = page.getByTestId("table-row-0");
    await ligne.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/roles\/role-/);
  });

  test("réinscription : décision et motifs en français", async ({ page }) => {
    const d = await preparerDonnees(page);
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto(`/admin/students/reinscription?matricule=${d.matricule}`);
    await page.locator("main").getByRole("button", { name: /Rechercher/ }).click();
    await expect(page.getByTestId("reinscription-decision")).toContainText(/Réinscription : (Autorisée|Sous conditions|Bloquée)/);
    await expect(page.getByTestId("reinscription-decision")).not.toContainText(/allowed|conditional|blocked/);
  });
});
