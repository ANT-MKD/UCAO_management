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

  test("codes pour toute la classe d'Awa : liste imprimée, puis Awa choisit son mot de passe avec son code", async ({ page }) => {
    const d = await preparerDonnees(page);
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/security/pin-activation");
    await page.getByTestId("pin-classe-choix").selectOption(d.classeId);
    await page.getByTestId("pin-classe-duree").selectOption("3");
    // Personne n'est coché d'office : la classe entière se choisit avec « Tout cocher ».
    await expect(page.getByTestId("pin-classe-generer")).toBeDisabled();
    await page.getByTestId("pin-classe-tout-cocher").click();
    await page.getByTestId("pin-classe-generer").click();
    await expect(page.getByTestId("pin-classe-confirmation")).toContainText("Chaque étudiant de");
    await expect(page.getByTestId("pin-classe-confirmation")).toContainText("valable 3 jours");
    await page.getByTestId("pin-classe-confirmer").click();
    const ligne = page.getByTestId(`pin-classe-ligne-${d.etudiantId}`);
    await expect(ligne).toContainText(d.matricule);
    const code = (await ligne.locator("td").nth(2).innerText()).trim();
    expect(code).toMatch(/^\d{6}$/);

    // La liste à imprimer s'ouvre dans une fenêtre, avec le code d'Awa et la marche à suivre
    const [fenetre] = await Promise.all([page.waitForEvent("popup"), page.getByTestId("pin-classe-imprimer").click()]);
    await expect(fenetre.locator("body")).toContainText(d.matricule);
    await expect(fenetre.locator("body")).toContainText(code);
    await expect(fenetre.locator("body")).toContainText("J'ai déjà un code");
    await expect(fenetre.locator("body")).toContainText("/login");
    await fenetre.close();

    // Awa choisit son mot de passe avec ce code, puis se connecte
    await page.evaluate(async () => (await import("/src/data/studentStore.ts")).clearAuthSession());
    await page.goto("/login");
    await page.getByTestId("link-mot-de-passe-oublie").click();
    await page.getByTestId("link-j-ai-un-code").click();
    await page.getByTestId("input-reset-identifier").fill(d.matricule);
    await page.getByTestId("input-reset-pin").fill(code);
    await page.getByTestId("input-new-password").fill("Rentree2026");
    await page.getByTestId("input-confirm-password").fill("Rentree2026");
    await page.getByTestId("button-reset-password").click();
    await expect(page.locator("body")).toContainText("Mot de passe réinitialisé");
    await connecter(page, d.matricule, "Rentree2026");
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test("un code pour Ousmane seul dans la classe, puis pour Awa depuis son dossier", async ({ page }) => {
    const d = await preparerDonnees(page);
    const ousmane = await page.evaluate(async (classeId) => {
      const S = await import("/src/data/studentStore.ts");
      const St = await import("/src/data/structureStore.ts");
      const classe = St.getClasses().find((c) => c.id === classeId)!;
      const e = S.registerNewEtudiant(
        { prenom: "Ousmane", nom: "DIALLO", sexe: "M", dateNaissance: "2002-03-04", email: "ousmane@test.sn", filiereId: classe.filiereId, classeId: classe.id, niveau: classe.niveau, statut: "inscrit", annee: "2025-2026", soldeDu: 0, inscriptionUniquePayee: true, motDePasse: "Provisoire1" },
        S.allocateMatricule(classe.filiere, "2025-2026"),
      );
      return { id: e.id, matricule: e.matricule };
    }, d.classeId);
    await connecter(page, "ADM-TEST", MDP_ADMIN);
    await page.goto("/admin/security/pin-activation");
    await page.getByTestId("pin-classe-choix").selectOption(d.classeId);
    await expect(page.getByTestId("pin-classe-compte")).toHaveText("0 / 2 coché(s)");
    // La recherche réduit la liste ; on coche Ousmane seul.
    await page.getByTestId("pin-classe-filtre").fill("diallo");
    await expect(page.getByTestId(`pin-classe-cocher-${d.etudiantId}`)).toHaveCount(0);
    await page.getByTestId(`pin-classe-cocher-${ousmane.id}`).check();
    await expect(page.getByTestId("pin-classe-compte")).toHaveText("1 / 2 coché(s)");
    await expect(page.getByTestId("pin-classe-generer")).toHaveText(/Générer 1 code/);
    await page.getByTestId("pin-classe-generer").click();
    await expect(page.getByTestId("pin-classe-confirmation")).toContainText("DIALLO Ousmane reçoit un nouveau code, valable 7 jours");
    await expect(page.getByTestId("pin-classe-confirmation")).toContainText("Les autres étudiants de la classe gardent le leur.");
    await page.getByTestId("pin-classe-confirmer").click();
    await expect(page.getByTestId(`pin-classe-ligne-${ousmane.id}`).locator("td").nth(2)).toHaveText(/^\d{6}$/);
    await expect(page.getByTestId(`pin-classe-ligne-${d.etudiantId}`)).toHaveCount(0);
    await expect(page.getByTestId("pin-classe-compte")).toHaveText("0 / 2 coché(s)");
    const [fenetre] = await Promise.all([page.waitForEvent("popup"), page.getByTestId("pin-classe-imprimer").click()]);
    await expect(fenetre.locator("body")).toContainText(ousmane.matricule);
    await expect(fenetre.locator("body")).not.toContainText(d.matricule);
    await fenetre.close();
    // Awa n'a reçu aucun code.
    const codesAwa = await page.evaluate(async (compte) =>
      (await import("/src/data/pinActivationStore.ts")).getPinsActivation().filter((p) => p.userId === compte).length, d.compteEtudiant);
    expect(codesAwa).toBe(0);

    // Depuis le dossier d'Awa : un code pour elle seule, valable 3 jours
    await page.goto(`/admin/students/${d.etudiantId}`);
    await page.getByTestId("dossier-code-pin").click();
    await page.getByTestId("dossier-code-pin-duree").selectOption("3");
    await page.getByTestId("dossier-code-pin-generer").click();
    const dans3Jours = await page.evaluate(() => new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("fr-FR"));
    await expect(page.getByTestId("dossier-code-pin-expire")).toContainText(`Valable jusqu'au ${dans3Jours} à`);
    await expect(page.getByTestId("dossier-code-pin-resultat")).toContainText("en main propre");
    const code = (await page.getByTestId("dossier-code-pin-code").innerText()).trim();
    expect(code).toMatch(/^\d{6}$/);
    await page.getByTestId("dossier-code-pin-fermer").click();
    await expect(page.getByTestId("dossier-code-pin-resultat")).toHaveCount(0);

    // Awa choisit son mot de passe avec ce code
    await page.evaluate(async () => (await import("/src/data/studentStore.ts")).clearAuthSession());
    await page.goto("/login");
    await page.getByTestId("link-mot-de-passe-oublie").click();
    await page.getByTestId("link-j-ai-un-code").click();
    await page.getByTestId("input-reset-identifier").fill(d.matricule);
    await page.getByTestId("input-reset-pin").fill(code);
    await page.getByTestId("input-new-password").fill("Dossier2026");
    await page.getByTestId("input-confirm-password").fill("Dossier2026");
    await page.getByTestId("button-reset-password").click();
    await expect(page.locator("body")).toContainText("Mot de passe réinitialisé");
  });

  test("le bouton Code PIN du dossier n'apparaît pas sans droit sur les codes", async ({ page }) => {
    const d = await preparerDonnees(page);
    await page.evaluate(async () => {
      const S = await import("/src/data/studentStore.ts");
      const R = await import("/src/data/roleStore.ts");
      const admin = S.getUserAccounts().find((u) => u.identifier === "ADM-TEST")!;
      const role = R.upsertRole({ code: "ACCUEIL", description: "Accueil des étudiants" }, admin.id);
      R.setRoleAccess(role.id, ["etudiants-liste"], admin.id);
      const c = S.creerCompteStaff({ role: "admin", prenom: "Binta", nom: "SOW", identifier: "SEC-ACC", email: "acc@test.sn", password: "Provisoire1", roleId: role.id }, admin.id);
      S.definirMotDePasseDefinitif(c.id, "Accueil2027");
    });
    await connecter(page, "SEC-ACC", "Accueil2027");
    await page.goto(`/admin/students/${d.etudiantId}`);
    await expect(page.locator("main")).toContainText(d.matricule);
    await expect(page.getByTestId("student-gerer-blocage")).toBeVisible();
    await expect(page.getByTestId("dossier-code-pin")).toHaveCount(0);
  });
});
