import { expect, test, type Page } from "@playwright/test";
import { connecter, MDP_ADMIN, preparerDonnees } from "./outils";

const apercu = (page: Page) => page.frameLocator('[data-testid="textes-apercu"]').locator("body");

async function ouvrirTextes(page: Page) {
  await page.goto("/admin/settings");
  await page.getByTestId("settings-tab-textes").click();
  await expect(page.getByTestId("textes-titre")).toBeVisible();
}

async function genererInscription(page: Page, matricule: string) {
  await page.goto("/admin/attestations");
  await page.getByTestId("attestation-recherche-etudiant").fill(matricule);
  await page.locator('[data-testid^="attestation-etudiant-option-"]').first().click();
  await page.getByTestId("attestation-type").selectOption("inscription");
  await page.getByTestId("attestation-generer").click();
  await expect(page.getByText("Attestation d'inscription générée pour Awa SECK")).toBeVisible();
}

test.describe("Paramètres → Textes des attestations", () => {
  test("l'établissement écrit les phrases, insère un champ avec un bouton, voit l'aperçu ; le texte reste après rechargement", async ({ page }) => {
    await preparerDonnees(page);
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await ouvrirTextes(page);

    // Texte de départ : le certificat d'inscription de l'établissement, rempli pour l'étudiante fictive.
    await expect(page.getByTestId("textes-titre")).toHaveValue("CERTIFICAT D'INSCRIPTION");
    await expect(apercu(page)).toContainText("AWA SECK");
    await expect(apercu(page)).toContainText("Née le 23 mai 2003 à Dakar");
    await expect(page.getByTestId("textes-enregistrer")).toBeDisabled();

    // Un champ s'insère à l'endroit du curseur.
    const dernier = page.getByTestId("textes-paragraphe-texte-4");
    await dernier.fill("Ce certificat est délivré à , pour servir et valoir ce que de droit.");
    await dernier.focus();
    await dernier.evaluate((z: HTMLTextAreaElement) => z.setSelectionRange(28, 28));
    await page.getByTestId("textes-champ-nom").click();
    await expect(dernier).toHaveValue("Ce certificat est délivré à {nom}, pour servir et valoir ce que de droit.");
    await expect(apercu(page)).toContainText("Ce certificat est délivré à Awa SECK, pour servir");

    // Un champ tapé à la main et inconnu, ou le matricule retiré : refusé, avec la raison.
    await page.getByTestId("textes-paragraphe-texte-3").fill("de nationalité {nationalite}, téléphone {telephone}.");
    await expect(page.getByTestId("textes-erreurs")).toContainText("Champ inconnu : {telephone}");
    await expect(page.getByTestId("textes-erreurs")).toContainText("Le matricule ({matricule}) doit figurer dans le texte.");
    await expect(page.getByTestId("textes-enregistrer")).toBeDisabled();
    await page.getByTestId("textes-paragraphe-texte-3").fill("de nationalité {nationalite}, sous le matricule {matricule}.");
    await expect(page.getByTestId("textes-erreurs")).toHaveCount(0);

    await page.getByTestId("textes-titre").fill("ATTESTATION D'INSCRIPTION");
    await page.getByTestId("textes-paragraphe-centre-3").check();
    await expect(apercu(page)).toContainText("ATTESTATION D'INSCRIPTION");
    await page.getByTestId("textes-enregistrer").click();
    await expect(page.getByText("Texte « Attestation d'inscription » enregistré")).toBeVisible();

    await page.reload();
    await page.getByTestId("settings-tab-textes").click();
    await expect(page.getByTestId("textes-titre")).toHaveValue("ATTESTATION D'INSCRIPTION");
    await expect(page.getByTestId("textes-paragraphe-texte-4")).toHaveValue("Ce certificat est délivré à {nom}, pour servir et valoir ce que de droit.");
    await expect(page.getByTestId("textes-paragraphe-centre-3")).toBeChecked();

    // L'attestation de réussite propose en plus la moyenne ; le texte de départ se rétablit.
    await page.getByTestId("textes-type-reussite").click();
    await expect(page.getByTestId("textes-champ-moyenne")).toBeVisible();
    await page.getByTestId("textes-type-inscription").click();
    await expect(page.getByTestId("textes-champ-moyenne")).toHaveCount(0);
    await page.getByTestId("textes-retablir").click();
    await expect(page.getByTestId("textes-titre")).toHaveValue("CERTIFICAT D'INSCRIPTION");
    await expect(page.getByTestId("textes-enregistrer")).toBeEnabled();
  });

  test("une attestation délivrée garde son texte ; la suivante prend le nouveau", async ({ page }) => {
    const donnees = await preparerDonnees(page);
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await genererInscription(page, donnees.matricule);
    const premiere = page.locator('[data-testid^="attestation-apercu-"]').first();
    await premiere.click();
    const document = page.frameLocator('[data-testid="attestation-preview-iframe"]').locator("body");
    await expect(document).toContainText("CERTIFICAT D'INSCRIPTION");
    await expect(document).toContainText("AWA SECK");
    await expect(document).toContainText(`sous le matricule ${donnees.matricule}`);

    await ouvrirTextes(page);
    await page.getByTestId("textes-titre").fill("ATTESTATION D'INSCRIPTION");
    await page.getByTestId("textes-paragraphe-texte-3").fill("est inscrite sous le matricule {matricule} pour l'année {annee}.");
    await page.getByTestId("textes-enregistrer").click();
    await expect(page.getByText("Texte « Attestation d'inscription » enregistré")).toBeVisible();

    await page.goto("/admin/attestations");
    const lignes = page.locator('[data-testid^="attestation-apercu-"]');
    await expect(lignes).toHaveCount(1);
    await lignes.first().click();
    await expect(document).toContainText("CERTIFICAT D'INSCRIPTION");
    await expect(document).not.toContainText("ATTESTATION D'INSCRIPTION");
    await page.keyboard.press("Escape");

    await genererInscription(page, donnees.matricule);
    await expect(lignes).toHaveCount(2);
    await lignes.first().click();
    await expect(document).toContainText("ATTESTATION D'INSCRIPTION");
    await expect(document).toContainText(`est inscrite sous le matricule ${donnees.matricule}`);
  });
});
