import { describe, expect, it } from "vitest";
import { preparerEtablissement } from "../fixtures/etablissement";

describe("facturation et encaissement", () => {
  it("un règlement partiel laisse le bon reste à payer", async () => {
    const e = await preparerEtablissement();
    const awa = e.inscrire("Awa", "SECK");
    const q = e.S.emettreQuittanceBrute({ etudiantId: awa.id, date: "2025-11-05", dateLimite: "2025-12-10", lignes: [{ label: "Scolarité — échéance 1", montant: 150000 }], reference: "FAC-1" });
    e.S.payerQuittance({ id: q.id, montant: 50000, moyen: "Espèces", reference: "CAISSE-1", date: "2025-11-20" });
    const apres = e.S.getPaiements().find((p) => p.id === q.id)!;
    const total = apres.lignes!.reduce((s, l) => s + l.montant, 0);
    expect(apres.montant).toBe(50000);
    expect(total - apres.montant).toBe(100000);
  });

  it("un paiement Wave déclaré n'efface la dette qu'après vérification par la caisse", async () => {
    const e = await preparerEtablissement();
    const Pd = await import("@/data/paiementDeclareStore");
    const awa = e.inscrire("Awa", "SECK");
    const q = e.S.emettreQuittanceBrute({ etudiantId: awa.id, date: "2025-11-05", dateLimite: "2025-12-10", lignes: [{ label: "Scolarité", montant: 100000 }], reference: "FAC-2" });
    // Impossible de déclarer plus que le reste à payer.
    expect(() => Pd.declarerPaiement({ quittanceId: q.id, etudiantId: awa.id, montant: 120000, moyen: "Wave", telephone: "771234567", referenceTransaction: "W1" })).toThrow();
    const d = Pd.declarerPaiement({ quittanceId: q.id, etudiantId: awa.id, montant: 100000, moyen: "Wave", telephone: "771234567", referenceTransaction: "W2" });
    expect(e.S.getPaiements().find((p) => p.id === q.id)!.montant).toBe(0);
    // La même somme ne peut pas être déclarée deux fois pendant la vérification.
    expect(() => Pd.declarerPaiement({ quittanceId: q.id, etudiantId: awa.id, montant: 1000, moyen: "Wave", telephone: "771234567", referenceTransaction: "W3" })).toThrow();
    Pd.confirmerPaiementDeclare(d.id, { id: e.admin.id, name: "Caisse" });
    expect(e.S.getPaiements().find((p) => p.id === q.id)!.montant).toBe(100000);
    const Enc = await import("@/data/encaissementStore");
    expect(Enc.getEncaissements().some((x) => x.quittanceId === q.id && x.montant === 100000)).toBe(true);
  });

  it("répartit une ligne en échéances égales entre deux dates", async () => {
    await preparerEtablissement();
    const G = await import("@/data/grilleFraisStore");
    const ech = G.calculerEcheances({ id: "l1", intitule: "Scolarité", montant: 600000, modalite: "echeances", nbEcheances: 3, dateDebut: "2025-11-10", dateLimite: "2026-05-10" }, "2025-2026");
    expect(ech.map((x) => x.montant)).toEqual([200000, 200000, 200000]);
    expect(ech[0].date).toBe("2025-11-10");
    expect(ech[2].date).toBe("2026-05-10");
  });

  it("rattache une ancienne date JJ/MM à la bonne année selon la rentrée (novembre)", async () => {
    await preparerEtablissement();
    const G = await import("@/data/grilleFraisStore");
    expect(G.resoudreDateGrille("2025-2026", "15/12")).toBe("2025-12-15");
    expect(G.resoudreDateGrille("2025-2026", "10/06")).toBe("2026-06-10");
  });
});
