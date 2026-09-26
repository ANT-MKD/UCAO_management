import { describe, expect, it } from "vitest";
import { preparerEtablissement } from "../fixtures/etablissement";

/** Règles de calcul des notes, vérifiées sur le vrai moteur (bulletinEngine) avec de vraies
 * saisies : évaluation → note → validation → publication → bulletin. */
describe("moyenne d'un EC", () => {
  it("pondère devoir et examen par leurs poids (12 à 40 %, 9 à 60 % → 10,20)", async () => {
    const e = await preparerEtablissement();
    const awa = e.inscrire("Awa", "SECK");
    const [ue] = e.uesDu("S5");
    const [ec] = e.ecsDe(ue.id);
    e.noter(awa.id, ec.id, "devoir", 12, 40);
    e.noter(awa.id, ec.id, "examen", 9, 60);
    const { computeBulletin } = await import("@/data/bulletinEngine");
    const b = computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5");
    const ligne = b.ues.flatMap((u) => u.ecs).find((x) => x.id === ec.id)!;
    expect(ligne.cc).toBe(12);
    expect(ligne.ef).toBe(9);
    expect(ligne.moyenne).toBeCloseTo(10.2, 5);
    expect(ligne.validee).toBe(true);
    expect(ligne.creditsObtenus).toBe(ec.credits);
  });

  it("n'est pas validé en dessous de 10 (8 et 11 à 50/50 → 9,50)", async () => {
    const e = await preparerEtablissement();
    const awa = e.inscrire("Awa", "SECK");
    const [ec] = e.ecsDe(e.uesDu("S5")[0].id);
    e.noter(awa.id, ec.id, "devoir", 8, 50);
    e.noter(awa.id, ec.id, "examen", 11, 50);
    const { computeBulletin } = await import("@/data/bulletinEngine");
    const ligne = computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5").ues.flatMap((u) => u.ecs).find((x) => x.id === ec.id)!;
    expect(ligne.moyenne).toBeCloseTo(9.5, 5);
    expect(ligne.validee).toBe(false);
    expect(ligne.creditsObtenus).toBe(0);
  });

  it("n'a pas de moyenne tant qu'il manque le devoir ou l'examen", async () => {
    const e = await preparerEtablissement();
    const awa = e.inscrire("Awa", "SECK");
    const [ec] = e.ecsDe(e.uesDu("S5")[0].id);
    e.noter(awa.id, ec.id, "devoir", 15, 40);
    const { computeBulletin } = await import("@/data/bulletinEngine");
    const ligne = computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5").ues.flatMap((u) => u.ecs).find((x) => x.id === ec.id)!;
    expect(ligne.moyenne).toBeUndefined();
    expect(ligne.validee).toBe(false);
  });

  it("remplace l'examen par la note de rattrapage (examen 6, rattrapage 11)", async () => {
    const e = await preparerEtablissement();
    const awa = e.inscrire("Awa", "SECK");
    const [ec] = e.ecsDe(e.uesDu("S5")[0].id);
    e.noter(awa.id, ec.id, "devoir", 10, 40);
    e.noter(awa.id, ec.id, "examen", 6, 60);
    e.noter(awa.id, ec.id, "examen", 11, 60, "rattrapage");
    const { computeBulletin } = await import("@/data/bulletinEngine");
    const ligne = computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5").ues.flatMap((u) => u.ecs).find((x) => x.id === ec.id)!;
    expect(ligne.ef).toBe(11);
    expect(ligne.moyenne).toBeCloseTo(10 * 0.4 + 11 * 0.6, 5);
  });
});

describe("moyenne de semestre et crédits", () => {
  it("valide les UE à 10 et additionne leurs crédits", async () => {
    const e = await preparerEtablissement();
    const awa = e.inscrire("Awa", "SECK");
    const ues = e.uesDu("S5");
    // Toutes les UE du semestre à 12, sauf la première à 8 (non validée).
    ues.forEach((ue, i) => {
      for (const ec of e.ecsDe(ue.id)) {
        const note = i === 0 ? 8 : 12;
        e.noter(awa.id, ec.id, "devoir", note, 40);
        e.noter(awa.id, ec.id, "examen", note, 60);
      }
    });
    const { computeBulletin } = await import("@/data/bulletinEngine");
    const b = computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5");
    expect(b.ues[0].validee).toBe(false);
    expect(b.ues.slice(1).every((u) => u.validee)).toBe(true);
    expect(b.creditsObtenus).toBe(ues.slice(1).reduce((s, u) => s + u.credits, 0));
    expect(b.creditsTotal).toBe(ues.reduce((s, u) => s + u.credits, 0));
    expect(b.moyenneSession).toBeGreaterThan(8);
    expect(b.moyenneSession).toBeLessThan(12);
  });
});
