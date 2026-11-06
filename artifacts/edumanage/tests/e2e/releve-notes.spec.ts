import { expect, test } from "@playwright/test";
import { connecter, MDP_ADMIN, viderNavigateur } from "./outils";

/** Relevé de notes au modèle officiel de l'ISAE, ouvert depuis le dossier d'une étudiante. */
test("aperçu du relevé du S6 d'Awa : disposition du modèle, crédits cumulés et moyennes de fin d'année", async ({ page }) => {
  await viderNavigateur(page);
  const { awaId, releveId } = await page.evaluate(async () => {
    const { preparerEtablissement } = await import("/tests/fixtures/etablissement.ts");
    const e = await preparerEtablissement();
    const awa = e.inscrire("Awa", "SECK");
    for (const semestre of ["S5", "S6"]) {
      for (const ue of e.uesDu(semestre)) for (const ec of e.ecsDe(ue.id)) e.noter(awa.id, ec.id, "examen", semestre === "S5" ? 12 : 14, 100);
    }
    const releve = e.S.getReleves().find((r) => r.etudiantId === awa.id && r.semestre.includes("(S6)"))!;
    return { awaId: awa.id, releveId: releve.id };
  });
  await connecter(page, "ADM-TEST", MDP_ADMIN);
  await page.goto(`/admin/students/${awaId}`);
  await page.getByTestId("tab-notes").click();
  await page.getByTestId(`dossier-bulletin-apercu-${releveId}`).click();
  const releve = page.frameLocator('[data-testid="releve-preview-iframe"]');
  await expect(releve.locator(".titre")).toHaveText("RELEVÉ DE NOTES Semestre 6");
  await expect(releve.locator(".identite")).toContainText("AWA SECK");
  await expect(releve.locator(".identite")).toContainText("PAS DE SPÉCIALITÉ");
  await expect(releve.locator("tr.ue").first()).toContainText("(Obligatoire)");
  await expect(releve.locator("tr.ue").first().locator("td.res")).toHaveText("UE Acquise");
  await expect(releve.locator("tr.moyenne")).toContainText("Moyenne Semestre 6");
  await expect(releve.locator("tr.moyenne")).toContainText("14,00");
  // Fin d'année et de cycle (S6) : cumul, moyenne annuelle et moyenne programme.
  const recap = releve.locator("table.recap");
  await expect(recap).toContainText("Cumul Crédits");
  await expect(recap.locator("tr", { hasText: "Moyenne Annuelle" })).toContainText("13,00");
  await expect(recap.locator("tr", { hasText: "Moyenne Programme" })).toContainText("13,00");
  await expect(releve.locator("body")).not.toContainText("N° REL");
});
