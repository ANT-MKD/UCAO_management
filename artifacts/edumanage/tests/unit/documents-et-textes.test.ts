import { describe, expect, it } from "vitest";
import { preparerEtablissement } from "../fixtures/etablissement";

describe("identité de l'établissement sur les documents officiels", () => {
  it("le nom livré par défaut est signalé tant qu'il n'est pas remplacé", async () => {
    const E = await import("@/data/etablissementStore");
    expect(E.nomEtablissementParDefaut()).toBe(true);
    expect(() => E.definirIdentiteEtablissement("  ", "Dakar, Sénégal", "u")).toThrow(/nom de l'établissement/);
    await preparerEtablissement();
    expect(E.nomEtablissementParDefaut()).toBe(false);
    expect(E.getEtablissement()).toMatchObject({ nom: "Université Catholique de l'Afrique de l'Ouest", adresse: "Dakar, Sénégal" });
  });

  it("en-tête et « Fait à » lus dans les Paramètres", async () => {
    const { admin } = await preparerEtablissement();
    const E = await import("@/data/etablissementStore");
    const { enteteEtablissementHtml, faitALe } = await import("@/lib/printDocument");
    expect(enteteEtablissementHtml()).toContain("Université Catholique de l'Afrique de l'Ouest");
    expect(enteteEtablissementHtml()).not.toContain("EduManage");
    expect(faitALe(new Date(2026, 9, 8))).toBe("Fait à Dakar, le 8 octobre 2026");

    E.updateEtablissement({ ...E.getEtablissement(), nom: "UCAO <Saint Michel>", adresse: "Ziguinchor, Sénégal", telephone: "33 000 00 00" }, admin.id);
    expect(enteteEtablissementHtml()).toContain("UCAO &lt;Saint Michel&gt;");
    expect(enteteEtablissementHtml()).toContain("Tél. 33 000 00 00");
    expect(faitALe(new Date(2026, 9, 8))).toBe("Fait à Ziguinchor, le 8 octobre 2026");
  });
});

describe("réinscription", () => {
  it("le seuil de crédits d'entrée ne s'applique qu'en changeant de niveau", async () => {
    const e = await preparerEtablissement();
    const awa = e.inscrire("Awa", "SECK");
    const { checkReinscriptionEligibility, LIBELLE_DECISION_REINSCRIPTION } = await import("@/data/reinscriptionEligibility");
    // Awa reste en L3 (redoublement) : pas de contrôle des 120 crédits d'entrée en L3.
    const reste = checkReinscriptionEligibility(awa.id, { ...e.niveau, creditsRequisEntree: 120 });
    expect(reste.reasons.join(" ")).not.toMatch(/Crédits cumulés/);
    // Entrée en Master 1 : le contrôle s'applique.
    const monte = checkReinscriptionEligibility(awa.id, { ...e.niveau, alias: "M1", nom: "Master 1", creditsRequisEntree: 180 });
    expect(monte.decision).toBe("blocked");
    expect(monte.reasons.join(" ")).toMatch(/Crédits cumulés insuffisants pour Master 1 \(0\/180/);
    expect(LIBELLE_DECISION_REINSCRIPTION[monte.decision]).toBe("Bloquée");
  });

  it("les impayés s'affichent en francs CFA lisibles", async () => {
    const e = await preparerEtablissement();
    const awa = e.inscrire("Awa", "SECK");
    e.S.emettreQuittanceBrute({ etudiantId: awa.id, date: "2025-11-05", lignes: [{ label: "Scolarité", montant: 150000 }], reference: "FAC-1" });
    const { checkReinscriptionEligibility } = await import("@/data/reinscriptionEligibility");
    expect(checkReinscriptionEligibility(awa.id).reasons.join(" ")).toMatch(/Impayés en cours \(150\s000\sF\sCFA\)/);
  });
});

describe("affichage des notes", () => {
  it("virgule décimale française, sans arrondi", async () => {
    const { formatNote } = await import("@/lib/notes");
    expect(formatNote(12.6)).toBe("12,60");
    expect(formatNote(9.996)).toBe("9,99");
    expect(formatNote(undefined)).toBe("—");
  });
});
