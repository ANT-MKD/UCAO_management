import type { Page } from "@playwright/test";

export const MDP_ADMIN = "Direction2026";
export const MDP_PROF = "Professeur2026";
export const MDP_ETUDIANT = "Etudiante2026";

/** Repart d'un navigateur vide (application jamais installée). */
export async function viderNavigateur(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

/** Installe un établissement de test complet dans le navigateur (mêmes fonctions que les écrans),
 * avec un professeur et une étudiante dont les mots de passe sont connus des tests. */
export async function preparerDonnees(page: Page) {
  await viderNavigateur(page);
  return page.evaluate(async ([mdpProf, mdpEtudiant]) => {
    const { preparerEtablissement } = await import("/tests/fixtures/etablissement.ts");
    const e = await preparerEtablissement();
    const compteProf = e.S.creerCompteStaff({ role: "teacher", prenom: "Mamadou", nom: "KANE", identifier: "PROF-KANE", email: "kane@test.sn", password: "Provisoire1", linkedId: e.prof.id }, e.admin.id);
    e.S.definirMotDePasseDefinitif(compteProf.id, mdpProf);
    const awa = e.inscrire("Awa", "SECK");
    const compteAwa = e.S.getUserAccounts().find((u) => u.linkedId === awa.id)!;
    e.S.definirMotDePasseDefinitif(compteAwa.id, mdpEtudiant);
    const [ec] = e.ecsDe(e.uesDu("S5")[0].id);
    const lundi = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
    const seance = e.S.addSeance({ ecId: ec.id, classeId: e.classe.id, salleId: e.St.getSalles()[0].id, prof: "Mamadou KANE", profId: e.prof.id, jour: 1, semaineDu: lundi, heureDebut: "08:00", heureFin: "10:00", type: "CM" }).seance!;
    return { matricule: awa.matricule, etudiantId: awa.id, compteEtudiant: compteAwa.id, compteProf: compteProf.id, ecId: ec.id, ecLibelle: ec.libelle, classeId: e.classe.id, seanceId: seance.id, lundi };
  }, [MDP_PROF, MDP_ETUDIANT]);
}

export async function connecter(page: Page, identifiant: string, motDePasse: string) {
  await page.goto("/login");
  await page.evaluate(async () => (await import("/src/data/studentStore.ts")).clearAuthSession());
  await page.goto("/login");
  await page.getByTestId("input-email").fill(identifiant);
  await page.getByTestId("input-password").fill(motDePasse);
  await page.getByTestId("button-submit").click();
  // Attendre la fin de la connexion (sauf si elle est refusée : on reste alors sur /login).
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 8000 }).catch(() => {});
}

/** Exécute une fonction de l'application dans le navigateur (production de données côté admin). */
export async function executer<T>(page: Page, code: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ([c, a]) => {
    const S = await import("/src/data/studentStore.ts");
    return new Function("S", "a", `return (async () => { ${c} })()`)(S, a);
  }, [code, arg] as const) as Promise<T>;
}
