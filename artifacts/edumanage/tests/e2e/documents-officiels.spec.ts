import { expect, test } from "@playwright/test";
import { connecter, MDP_ADMIN, preparerDonnees } from "./outils";

// Bannière d'essai : une image PNG de 4 × 1 pixels.
const BANNIERE_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAABCAYAAAD5PA/NAAAAEElEQVR42mNk+M9Qz0AEAAAk6gGBNGOvTQAAAABJRU5ErkJggg==", "base64");

test.describe("Paramètres → Documents officiels", () => {
  test("l'administration règle la bannière, le pied de page et la ville ; l'aperçu les montre et ils restent après rechargement", async ({ page }) => {
    await preparerDonnees(page);
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/settings");
    await page.getByTestId("settings-tab-documents").click();
    await expect(page.getByTestId("documents-apercu")).toContainText("En-tête actuel des documents");

    await page.getByTestId("entete-forme-banniere").check({ force: true });
    await page.getByTestId("entete-banniere-input").setInputFiles({ name: "banniere.png", mimeType: "image/png", buffer: BANNIERE_PNG });
    await expect(page.getByTestId("documents-apercu").locator("img")).toHaveAttribute("src", /^data:image\/png;base64,/);
    await page.getByTestId("pied-ligne-0").fill("Route de Mont-Rolland");
    await page.getByTestId("pied-ligne-1").fill("Tél. : (00221) 33 951 14 81");
    await page.getByTestId("documents-ville").fill("Thiès");
    await expect(page.getByTestId("documents-apercu")).toContainText("Route de Mont-Rolland");
    await page.getByTestId("documents-enregistrer").click();
    await expect(page.getByText("En-tête et pied de page des documents enregistrés.")).toBeVisible();

    await page.reload();
    await page.getByTestId("settings-tab-documents").click();
    await expect(page.getByTestId("entete-forme-banniere")).toBeChecked();
    await expect(page.getByTestId("documents-apercu").locator("img")).toHaveAttribute("src", /^data:image\/png;base64,/);
    await expect(page.getByTestId("pied-ligne-1")).toHaveValue("Tél. : (00221) 33 951 14 81");
    await expect(page.getByTestId("documents-ville")).toHaveValue("Thiès");

    // L'onglet Université n'efface pas l'en-tête en enregistrant l'identité.
    await page.getByTestId("settings-tab-universite").click();
    await page.getByTestId("etab-email").fill("isaet@ucao.edu.sn");
    await page.getByTestId("etab-sauvegarder").click();
    await page.getByTestId("settings-tab-documents").click();
    await expect(page.getByTestId("entete-forme-banniere")).toBeChecked();
    await expect(page.getByTestId("documents-ville")).toHaveValue("Thiès");
  });

  test("en-tête composé : l'exemple remplit les lignes ; une bannière sans image est refusée avec un message clair", async ({ page }) => {
    await preparerDonnees(page);
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/settings");
    await page.getByTestId("settings-tab-documents").click();

    await page.getByTestId("entete-forme-banniere").check({ force: true });
    await page.getByTestId("documents-enregistrer").click();
    await expect(page.getByTestId("documents-erreurs")).toContainText("Choisissez l'image de la bannière");

    await page.getByTestId("entete-forme-compose").check({ force: true });
    await page.getByTestId("entete-exemple").click();
    await expect(page.getByTestId("entete-ligne-texte-1")).toHaveValue("Faculté des Sciences de Gestion");
    await expect(page.getByTestId("documents-apercu")).toContainText("Institut Supérieur d'Administration des Entreprises Thiès");
    await page.getByTestId("entete-ajouter-ligne").click();
    await expect(page.getByTestId("entete-ajouter-ligne")).toBeDisabled();
    await page.getByTestId("documents-enregistrer").click();
    await expect(page.getByText("En-tête et pied de page des documents enregistrés.")).toBeVisible();
    await page.reload();
    await page.getByTestId("settings-tab-documents").click();
    // La ligne ajoutée vide n'est pas enregistrée : il reste les cinq lignes de l'exemple.
    await expect(page.locator('[data-testid^="entete-ligne-texte-"]')).toHaveCount(5);
  });
});
