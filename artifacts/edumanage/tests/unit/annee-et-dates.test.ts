import { describe, expect, it } from "vitest";
import { decalerDeNAns, moisDeLAnneeAcademique, validerDatesAnnee } from "@/lib/anneeAcademique";

describe("année académique", () => {
  it("refuse des dates incohérentes", () => {
    expect(validerDatesAnnee("2026-2027", "2025-11-02", "2027-07-31")).toMatch(/2026/);
    expect(validerDatesAnnee("2026-2027", "2026-11-02", "2026-10-01")).toMatch(/postérieure/);
    expect(validerDatesAnnee("2026-2027", "2026-11-02", "2028-01-10")).toMatch(/2027/);
    expect(validerDatesAnnee("2026-2027", "2026-11-02", "2027-07-31")).toBeNull();
  });

  it("suit les vrais mois de l'année (rentrée en novembre)", () => {
    const mois = moisDeLAnneeAcademique({ libelle: "2026-2027", dateDebut: "2026-11-02", dateFin: "2027-07-31" });
    expect(mois[0]).toBe("Novembre 2026");
    expect(mois[mois.length - 1]).toBe("Juillet 2027");
    expect(mois).toHaveLength(9);
  });

  it("décale un 29 février sur une année non bissextile", () => {
    expect(decalerDeNAns("2028-02-29", 1)).toBe("2029-02-28");
  });
});

describe("matricule", () => {
  it("porte la première année de l'année académique, pas l'année civile", async () => {
    const S = await import("@/data/studentStore");
    expect(S.peekNextMatricule("LQHSE", "2026-2027")).toBe("2026-LQHSE-0001");
    expect(S.allocateMatricule("LQHSE", "2026-2027")).toBe("2026-LQHSE-0001");
    expect(S.allocateMatricule("LQHSE", "2026-2027")).toBe("2026-LQHSE-0002");
  });
});
