import { describe, expect, it, vi } from "vitest";
import { MOT_DE_PASSE_ADMIN, preparerEtablissement } from "../fixtures/etablissement";

describe("installation et connexion", () => {
  it("ne s'installe qu'une seule fois, et plus aucun compte par défaut", async () => {
    const e = await preparerEtablissement();
    expect(e.S.installationRequise()).toBe(false);
    expect(() => e.S.installerEtablissement({ prenom: "X", nom: "Y", identifier: "ADM-2", email: "x@y.sn", password: "Password123", annee: { libelle: "2025-2026", dateDebut: "2025-11-03", dateFin: "2026-07-31" } })).toThrow();
    expect(e.S.authenticateUser("ADM-0001", "demo123")).toBeNull();
    expect(e.S.authenticateUser("ADM-TEST", MOT_DE_PASSE_ADMIN)?.role).toBe("admin");
    expect(e.S.authenticateUser("ADM-TEST", "mauvais")).toBeNull();
  });

  it("les mots de passe provisoires sont aléatoires et sans caractère ambigu", async () => {
    const { generateMotDePasse } = await import("@/lib/inscriptionConstants");
    const tirages = new Set(Array.from({ length: 50 }, () => generateMotDePasse()));
    expect(tirages.size).toBe(50);
    for (const m of tirages) expect(m).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{8}$/);
  });
});

describe("rattachement des professeurs", () => {
  it("identifie un professeur par son identifiant, jamais par son seul nom", async () => {
    const { matchesProf } = await import("@/lib/teacherUtils");
    const kane1 = { id: "t1", prenom: "Mamadou", nom: "KANE" } as never;
    const kane2 = { id: "t2", prenom: "Mamadou", nom: "KANE" } as never;
    expect(matchesProf(kane1, "Mamadou KANE", "t1")).toBe(true);
    expect(matchesProf(kane2, "Mamadou KANE", "t1")).toBe(false);
    expect(matchesProf(kane1, "Awa KANE")).toBe(false);
  });
});

describe("stockage plein", () => {
  it("un enregistrement impossible est signalé au lieu d'échouer en silence", async () => {
    const L = await import("@/lib/stockageLocal");
    const signal = vi.fn();
    window.addEventListener(L.EVENEMENT_STOCKAGE_PLEIN, signal);
    const espion = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new DOMException("plein", "QuotaExceededError"); });
    expect(L.ecrireStockage("cle", "valeur")).toBe(false);
    expect(signal).toHaveBeenCalledTimes(1);
    espion.mockRestore();
    expect(L.ecrireStockage("cle", "valeur")).toBe(true);
  });
});
