import { describe, expect, it } from "vitest";
import { preparerEtablissement } from "../fixtures/etablissement";
import type { ReglesCalcul } from "@/data/scolariteConfigStore";

/** Chaque règle de calcul modifiée dans Paramétrage scolarité change réellement le résultat. */
async function avecRegles(regles: Partial<ReglesCalcul>) {
  const e = await preparerEtablissement();
  const Sc = await import("@/data/scolariteConfigStore");
  let config = Sc.getScolariteConfigs().find((c) => c.filiereId === e.classe.filiereId);
  expect(config, "la filière a sa configuration de scolarité").toBeDefined();
  const res = Sc.updateReglesCalcul(config!.id, { ...Sc.REGLES_CALCUL_DEFAUT, ...regles }, "Test");
  expect(res.ok).toBe(true);
  config = Sc.getScolariteConfigs().find((c) => c.filiereId === e.classe.filiereId);
  const { computeBulletin } = await import("@/data/bulletinEngine");
  const bulletin = (etudiantId: string) => computeBulletin(etudiantId, e.classe.id, e.classe.filiereId, "L3", "S5");
  return { e, Sc, config: config!, bulletin };
}

describe("règles de calcul configurables", () => {
  it("seuil de validation d'un EC relevé à 12 : un 10,20 n'est plus validé", async () => {
    const { e, bulletin } = await avecRegles({ seuilValidationEc: 12 });
    const awa = e.inscrire("Awa", "SECK");
    const [ec] = e.ecsDe(e.uesDu("S5")[0].id);
    e.noter(awa.id, ec.id, "devoir", 12, 40);
    e.noter(awa.id, ec.id, "examen", 9, 60);
    const ligne = bulletin(awa.id).ues.flatMap((u) => u.ecs).find((x) => x.id === ec.id)!;
    expect(ligne.moyenne).toBeCloseTo(10.2, 5);
    expect(ligne.validee).toBe(false);
  });

  it("note plancher à 7 : un EC à 5 empêche de valider l'UE malgré une moyenne ≥ 10", async () => {
    const { e, bulletin } = await avecRegles({ noteEliminatoireEc: 7 });
    const awa = e.inscrire("Awa", "SECK");
    const ue = e.uesDu("S5").find((u) => e.ecsDe(u.id).length >= 2)!;
    const [ec1, ...autres] = e.ecsDe(ue.id);
    e.noter(awa.id, ec1.id, "devoir", 5, 50); e.noter(awa.id, ec1.id, "examen", 5, 50);
    for (const ec of autres) { e.noter(awa.id, ec.id, "devoir", 18, 50); e.noter(awa.id, ec.id, "examen", 18, 50); }
    const ligneUe = bulletin(awa.id).ues.find((u) => u.id === ue.id)!;
    expect(ligneUe.moyenne!).toBeGreaterThanOrEqual(10);
    expect(ligneUe.validee).toBe(false);
  });

  it("compensation entre UE : semestre à la moyenne → tous les crédits acquis", async () => {
    const { e, bulletin } = await avecRegles({ creditsParCompensation: true });
    const awa = e.inscrire("Awa", "SECK");
    const ues = e.uesDu("S5");
    ues.forEach((ue, i) => e.ecsDe(ue.id).forEach((ec) => { const n = i === 0 ? 8 : 13; e.noter(awa.id, ec.id, "devoir", n, 40); e.noter(awa.id, ec.id, "examen", n, 60); }));
    const b = bulletin(awa.id);
    expect(b.ues[0].validee).toBe(false);
    expect(b.ues[0].valideeParCompensation).toBe(true);
    expect(b.creditsObtenus).toBe(b.creditsTotal);
  });

  it("sans compensation (valeur d'origine), l'UE à 8 ne rapporte pas ses crédits", async () => {
    const { e, bulletin } = await avecRegles({});
    const awa = e.inscrire("Awa", "SECK");
    const ues = e.uesDu("S5");
    ues.forEach((ue, i) => e.ecsDe(ue.id).forEach((ec) => { const n = i === 0 ? 8 : 13; e.noter(awa.id, ec.id, "devoir", n, 40); e.noter(awa.id, ec.id, "examen", n, 60); }));
    const b = bulletin(awa.id);
    expect(b.creditsObtenus).toBe(b.creditsTotal - ues[0].credits);
  });

  it("rattrapage « meilleure des deux » : examen 12, rattrapage 9 → on garde 12", async () => {
    const { e, bulletin } = await avecRegles({ regleRattrapage: "meilleure" });
    const awa = e.inscrire("Awa", "SECK");
    const [ec] = e.ecsDe(e.uesDu("S5")[0].id);
    e.noter(awa.id, ec.id, "devoir", 10, 40);
    e.noter(awa.id, ec.id, "examen", 12, 60);
    e.noter(awa.id, ec.id, "examen", 9, 60, "rattrapage");
    expect(bulletin(awa.id).ues.flatMap((u) => u.ecs).find((x) => x.id === ec.id)!.ef).toBe(12);
  });

  it("rattrapage « plafonné à 10 » : un 14 au rattrapage est retenu à 10", async () => {
    const { e, bulletin } = await avecRegles({ regleRattrapage: "plafonnee", plafondRattrapage: 10 });
    const awa = e.inscrire("Awa", "SECK");
    const [ec] = e.ecsDe(e.uesDu("S5")[0].id);
    e.noter(awa.id, ec.id, "devoir", 10, 40);
    e.noter(awa.id, ec.id, "examen", 6, 60);
    e.noter(awa.id, ec.id, "examen", 14, 60, "rattrapage");
    expect(bulletin(awa.id).ues.flatMap((u) => u.ecs).find((x) => x.id === ec.id)!.ef).toBe(10);
  });

  it("jury : seuil d'absences et marge de rattrapage suivent la filière", async () => {
    const { e, config } = await avecRegles({ heuresAbsenceExclusion: 20, margeRattrapage: 1 });
    const R = await import("@/data/reglesValidationStore");
    const regle = { id: "r", filiereId: config.filiereId, filiere: "", type: "semestre" as const, validationParCredit: false, validationParMoyenne: true, creditPassage: 0, moyennePassage: 10, moyenneEliminatoire: 0 };
    expect(R.decideValidation(12, 30, 15, regle)).toBe("admis");
    expect(R.decideValidation(12, 30, 25, regle)).toBe("exclu");
    expect(R.decideValidation(9.2, 30, 0, regle)).toBe("rattrapage");
    expect(R.decideValidation(8.5, 30, 0, regle)).toBe("ajourne");
    void e;
  });

  it("refuse des règles incohérentes", async () => {
    const { Sc, config } = await avecRegles({});
    expect(Sc.updateReglesCalcul(config.id, { ...Sc.REGLES_CALCUL_DEFAUT, noteEliminatoireEc: 12, seuilValidationUe: 10 }, "Test").ok).toBe(false);
    expect(Sc.updateReglesCalcul(config.id, { ...Sc.REGLES_CALCUL_DEFAUT, poidsDevoirDefaut: 140 }, "Test").ok).toBe(false);
  });
});
