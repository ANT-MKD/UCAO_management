import { describe, expect, it, vi } from "vitest";
import { preparerEtablissement } from "../fixtures/etablissement";

/** Crédits des années précédentes (L1, L2) : on les fixe pour vérifier qu'ils s'ajoutent bien au
 * cumul du relevé, sans dépendre de la saisie de deux années de notes. */
vi.mock("@/data/bulletinEngine", async (original) => {
  const reel = await original<typeof import("@/data/bulletinEngine")>();
  return {
    ...reel,
    computeCreditsCumulesParcours: vi.fn(() => ({
      creditsObtenus: 0, creditsTotal: 0,
      detail: [
        { annee: "2023-2024", niveau: "L1", creditsObtenus: 60, creditsTotal: 60 },
        { annee: "2024-2025", niveau: "L2", creditsObtenus: 54, creditsTotal: 60 },
        { annee: "2025-2026", niveau: "L3", creditsObtenus: 999, creditsTotal: 999 },
      ],
    })),
  };
});

describe("cumul des crédits sur le relevé", () => {
  it("années précédentes + semestres de l'année jusqu'à celui du relevé (l'année en cours n'est pas reprise du parcours)", async () => {
    const e = await preparerEtablissement();
    const awa = e.inscrire("Awa", "SECK");
    for (const ue of e.uesDu("S5")) for (const ec of e.ecsDe(ue.id)) e.noter(awa.id, ec.id, "examen", 12, 100);
    const { resolveBulletin } = await import("@/pages/admin/RelevesPage");
    const { computeBulletin } = await import("@/data/bulletinEngine");
    const releve = e.S.getReleves().find((r) => r.etudiantId === awa.id && r.semestre.includes("(S5)"))!;
    const creditsS5 = computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5").creditsObtenus;
    expect(creditsS5).toBeGreaterThan(0);
    expect(resolveBulletin(releve, e.S.getEtudiants())!.recapitulatif?.cumulCredits).toBe(60 + 54 + creditsS5);
  });
});
