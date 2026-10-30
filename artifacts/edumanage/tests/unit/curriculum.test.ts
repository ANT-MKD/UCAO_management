import { describe, expect, it } from "vitest";

describe("création des UE et des EC — propositions automatiques", () => {
  it("code d'UE : filière + semestre + numéro suivant", async () => {
    const { proposerCodeUe } = await import("@/lib/codesCurriculum");
    expect(proposerCodeUe("LQHSE", "S5", [])).toBe("LQHSES5U1");
    expect(proposerCodeUe("LQHSE", "S5", ["LQHSES5U1", "LQHSES5U3", "LQHSES6U9", "LIGS5U7"])).toBe("LQHSES5U4");
  });

  it("code d'EC : code de l'UE + E + numéro suivant", async () => {
    const { proposerCodeEc } = await import("@/lib/codesCurriculum");
    expect(proposerCodeEc("LQHSES5U3", ["LQHSES5U3E1", "LQHSES5U3E2", "LQHSES5U1E5"])).toBe("LQHSES5U3E3");
    expect(proposerCodeEc("LQHSES5U4", [])).toBe("LQHSES5U4E1");
  });

  it("intitulé abrégé : initiales des mots importants", async () => {
    const { abregerIntitule } = await import("@/lib/codesCurriculum");
    expect(abregerIntitule("Système de Management Intégré")).toBe("SMI");
    expect(abregerIntitule("Prévention des Risques Majeurs")).toBe("PRM");
    expect(abregerIntitule("Comptabilité")).toBe("COMP");
    expect(abregerIntitule("")).toBe("");
  });
});

describe("plus de coefficient", () => {
  it("aucune méthode de calcul au coefficient n'est proposée, et une ancienne retombe sur la moyenne simple", async () => {
    const { getCodesMethodesDisponibles, appliquerMethodeCalcul } = await import("@/lib/bulletinCalculs");
    for (const n of ["moyenneUe", "moyenneSession", "moyenneAnnee", "moyenneProgramme"] as const) {
      expect(getCodesMethodesDisponibles(n).some((c) => /Coefficient|BaseNotation/.test(c))).toBe(false);
    }
    expect(appliquerMethodeCalcul("moyenneUe", "calculMoyenneCoefficient", [{ moyenne: 12, credits: 6 }, { moyenne: 8, credits: 4 }])).toBe(10);
    const { nomsVariables } = await import("@/data/formulesCalcul");
    expect(nomsVariables("noteEc").some((v) => v.startsWith("COEFF"))).toBe(false);
    expect(nomsVariables("moyenneUe").some((v) => v.startsWith("COEFF"))).toBe(false);
  });
});
