import { expect, test } from "@playwright/test";
import { connecter, MDP_ADMIN, MDP_ETUDIANT, MDP_PROF, preparerDonnees } from "./outils";

/** Écrans Sécurité (Utilisateurs, Codes PIN, Portails), sans Supabase : mêmes règles qu'avec la base. */
test.describe("sécurité des comptes", () => {
  test("créer un compte, bloquer KANE, lui remettre un code, fermer le portail d'Awa", async ({ page }) => {
    const d = await preparerDonnees(page);
    await connecter(page, "ADM-TEST", MDP_ADMIN);

    // Nouveau compte d'administration
    await page.goto("/admin/users");
    await page.getByTestId("user-ajouter").click();
    await page.getByTestId("user-role").selectOption("admin");
    await page.getByTestId("user-prenom").fill("Aminata");
    await page.getByTestId("user-nom").fill("NDIAYE");
    await page.getByTestId("user-identifiant").fill("SEC-2");
    await page.getByTestId("user-email").fill("a.ndiaye@ucao.edu");
    await page.getByTestId("user-password").fill("Provisoire1");
    await page.getByTestId("user-sauvegarder").click();
    await expect(page.locator("main")).toContainText("SEC-2");

    // KANE bloqué : il ne se connecte plus
    await page.goto(`/admin/users/${d.compteProf}`);
    await page.getByTestId("user-toggle-actif").click();
    await expect(page.locator("main")).toContainText("Désactivé");
    // Code PIN remis à KANE
    await page.getByTestId("user-generer-pin").click();
    await expect(page.getByTestId("user-dernier-pin")).toHaveText(/^\d{6}$/);
    await connecter(page, "PROF-KANE", MDP_PROF);
    await expect(page.locator("body")).toContainText("Ce compte a été désactivé");
    await expect(page).toHaveURL(/\/login/);

    // Le code apparaît dans l'historique, actif, puis révoqué
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/security/pin-activation");
    const ligne = page.locator("tr", { hasText: "PROF-KANE" });
    await expect(ligne).toContainText("Actif");
    await ligne.getByRole("button", { name: "Révoquer" }).click();
    await expect(ligne).toContainText("Révoqué");

    // Réactivé, KANE entre de nouveau
    await page.goto(`/admin/users/${d.compteProf}`);
    await page.getByTestId("user-toggle-actif").click();
    await expect(page.locator("main")).toContainText("Actif");
    await connecter(page, "PROF-KANE", MDP_PROF);
    await expect(page).toHaveURL(/\/teacher\/dashboard/);

    // Portail Étudiants fermé : Awa est refusée, puis entre après réouverture
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/security/portails");
    await page.getByTestId("portail-toggle-global-student").click();
    await expect(page.getByTestId("portail-toggle-global-student")).toHaveText("Désactivé");
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await expect(page.locator("body")).toContainText("Le portail Étudiants est actuellement désactivé");
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/security/portails");
    await page.getByTestId("portail-toggle-global-student").click();
    await expect(page.getByTestId("portail-toggle-global-student")).toHaveText("Activé");
    await connecter(page, d.matricule, MDP_ETUDIANT);
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });
});
