import { describe, expect, it, vi } from "vitest";
import { ANNEE_TEST, preparerEtablissement } from "../fixtures/etablissement";

/** Règlements de calcul par année, résultats figés à la clôture du jury, comparaison avant/après. */
async function etablissement() {
  const e = await preparerEtablissement();
  const R = await import("@/data/reglementCalculStore");
  const { computeBulletin } = await import("@/data/bulletinEngine");
  const awa = e.inscrire("Awa", "SECK");
  const ue = e.uesDu("S5")[0];
  const [ec1, ec2] = e.ecsDe(ue.id);
  e.noter(awa.id, ec1.id, "devoir", 14, 30); e.noter(awa.id, ec1.id, "examen", 12, 70);
  e.noter(awa.id, ec2.id, "devoir", 8, 30); e.noter(awa.id, ec2.id, "examen", 7, 70);
  const noteEc1 = () => computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5").ues.find((u) => u.id === ue.id)!.ecs.find((l) => l.id === ec1.id)!.moyenne;
  const master = { noteEc: "DEVOIR × 0,4 + EXAMEN_RETENU × 0,6" };
  return { e, R, awa, ue, ec1, noteEc1, master };
}

describe("règlements de calcul par année", () => {
  it("un règlement préparé pour l'année suivante ne change rien à l'année en cours", async () => {
    const { e, R, noteEc1, master } = await etablissement();
    e.S.addAnneeAcademique("2026-2027", { dateDebut: "2026-11-02", dateFin: "2027-07-30" });
    expect(R.enregistrerReglement({ nom: "LMD 2026-2027", annee: "2026-2027", filiereIds: [e.classe.filiereId], formules: master }, undefined, "Test").ok).toBe(true);
    expect(noteEc1()).toBeCloseTo(12.6, 9);
    expect(R.enregistrerReglement({ nom: "LMD 2025-2026", annee: ANNEE_TEST, filiereIds: [e.classe.filiereId], formules: master }, undefined, "Test").ok).toBe(true);
    expect(noteEc1()).toBeCloseTo(12.8, 9);
  });

  it("une filière n'a qu'un règlement par année ; les règlements se recopient d'une année sur l'autre", async () => {
    const { e, R, master } = await etablissement();
    expect(R.enregistrerReglement({ nom: "A", annee: ANNEE_TEST, filiereIds: [e.classe.filiereId], formules: master }, undefined, "Test").ok).toBe(true);
    const doublon = R.enregistrerReglement({ nom: "B", annee: ANNEE_TEST, filiereIds: [e.classe.filiereId], formules: {} }, undefined, "Test");
    expect(doublon.ok).toBe(false);
    expect(doublon.reason).toMatch(/déjà le règlement « A »/);
    expect(R.copierReglements(ANNEE_TEST, "2026-2027", "Test")).toBe(1);
    expect(R.reglementPour(e.classe.filiereId, "2026-2027")?.formules.noteEc).toBe(master.noteEc);
    expect(R.copierReglements(ANNEE_TEST, "2026-2027", "Test")).toBe(0);
  });
});

describe("résultats figés à la clôture du jury", () => {
  it("après clôture, un changement de formule ne modifie plus le bulletin ; rouvrir le libère", async () => {
    const { e, R, awa, noteEc1, master } = await etablissement();
    const Rv = await import("@/data/reglesValidationStore");
    const D = await import("@/data/deliberationStore");
    const sem = e.semestreDe("S5");
    const d = D.chargerDeliberation({ filiereId: e.classe.filiereId, filiere: e.classe.filiere, annee: ANNEE_TEST, niveauAlias: "L3", niveauLabel: "Licence 3", classeId: e.classe.id, classe: e.classe.nom, semestreId: sem.id, semestreAlias: "S5", semestreLabel: "Semestre 5 (S5)", etudiants: [{ id: awa.id, prenom: "Awa", nom: "SECK", matricule: awa.matricule }], regle: Rv.getRegleValidation(e.classe.filiereId, "semestre")!, effectuePar: "Test" });
    D.cloturerDeliberation(d.id);
    expect(R.enregistrerReglement({ nom: "Master", annee: ANNEE_TEST, filiereIds: [e.classe.filiereId], formules: master }, undefined, "Test").ok).toBe(true);
    // Le bulletin délibéré reste celui qui a été délivré.
    expect(noteEc1()).toBeCloseTo(12.6, 9);
    D.reouvrirDeliberation(d.id);
    expect(noteEc1()).toBeCloseTo(12.8, 9);
  });
});

describe("comparaison avant/après", () => {
  it("liste les étudiants dont la moyenne, les crédits ou la décision changent", async () => {
    const { e, awa, ue, master } = await etablissement();
    const { comparerReglement } = await import("@/data/comparaisonReglement");
    const moussa = e.inscrire("Moussa", "FALL");
    e.ecsDe(ue.id).forEach((ec) => { e.noter(moussa.id, ec.id, "devoir", 15, 30); e.noter(moussa.id, ec.id, "examen", 15, 70); });
    // UE acquise dès 9,5 : Awa (9,95) gagne ses crédits, Moussa (15) ne change pas.
    const c = comparerReglement({ annee: ANNEE_TEST, filiereIds: [e.classe.filiereId], formules: { creditsUe: "SI(MOYENNE_UE >= 9,5 ; CREDITS_UE ; 0)" } });
    expect(c.nbEtudiants).toBe(2);
    expect(c.nbEtudiantsChanges).toBe(1);
    const credits = c.changements.find((x) => x.etudiantId === awa.id && x.quoi === "Crédits")!;
    expect(credits.periode).toBe("S5");
    expect(credits.avant).toMatch(/^0\//);
    expect(credits.apres).toMatch(/^10\//);
    expect(c.changements.some((x) => x.etudiantId === moussa.id)).toBe(false);
    // La note de matière 40/60 change la moyenne d'Awa.
    const c2 = comparerReglement({ annee: ANNEE_TEST, filiereIds: [e.classe.filiereId], formules: master });
    expect(c2.changements.some((x) => x.etudiantId === awa.id && x.quoi === "Moyenne")).toBe(true);
  });
});

describe("historique des règlements", () => {
  const moitie = { noteEc: "DEVOIR × 0,5 + EXAMEN_RETENU × 0,5" };

  it("chaque enregistrement ajoute une version avec ce qui a changé ; un enregistrement identique n'en ajoute pas", async () => {
    const { e, R, master } = await etablissement();
    const payload = { nom: "LMD", annee: ANNEE_TEST, filiereIds: [e.classe.filiereId], formules: master };
    const id = R.enregistrerReglement(payload, undefined, "Awa NDIAYE").reglement!.id;
    R.enregistrerReglement({ ...payload, formules: moitie }, id, "Moussa FALL");
    R.enregistrerReglement({ ...payload, formules: moitie }, id, "Moussa FALL");
    const versions = R.getHistoriqueReglement(id);
    expect(versions.map((v) => [v.numero, v.action, v.par])).toEqual([[2, "modification", "Moussa FALL"], [1, "creation", "Awa NDIAYE"]]);
    const d = R.differencesVersions(versions[1], versions[0]);
    expect(d.formules).toEqual([{ cle: "noteEc", titre: expect.any(String), avant: master.noteEc, apres: moitie.noteEc }]);
    expect(d.nom).toBeUndefined();
    expect(d.filieresAjoutees).toEqual([]);
    // L'historique est conservé d'une ouverture à l'autre.
    vi.resetModules();
    const R2 = await import("@/data/reglementCalculStore");
    expect(R2.getHistoriqueReglement(id)).toHaveLength(2);
  });

  it("revenir à une ancienne version remet son calcul et ajoute une version « retour »", async () => {
    const { e, R, noteEc1, master } = await etablissement();
    const payload = { nom: "LMD", annee: ANNEE_TEST, filiereIds: [e.classe.filiereId], formules: master };
    const id = R.enregistrerReglement(payload, undefined, "Test").reglement!.id;
    R.enregistrerReglement({ ...payload, formules: moitie }, id, "Test");
    expect(noteEc1()).toBeCloseTo(13, 9);
    const v1 = R.getHistoriqueReglement(id).find((v) => v.numero === 1)!;
    expect(R.enregistrerReglement({ nom: v1.nom, annee: v1.annee, filiereIds: v1.filiereIds, formules: v1.formules }, id, "Test", { depuisVersion: 1 }).ok).toBe(true);
    expect(noteEc1()).toBeCloseTo(12.8, 9);
    const [v3] = R.getHistoriqueReglement(id);
    expect([v3.numero, v3.action, v3.depuisVersion]).toEqual([3, "retour", 1]);
  });

  it("un règlement supprimé reste dans l'historique et peut être recréé à partir d'une version", async () => {
    const { e, R, noteEc1, master } = await etablissement();
    const id = R.enregistrerReglement({ nom: "LMD", annee: ANNEE_TEST, filiereIds: [e.classe.filiereId], formules: master }, undefined, "Test").reglement!.id;
    expect(R.supprimerReglement(id, "Test").ok).toBe(true);
    expect(noteEc1()).toBeCloseTo(12.6, 9);
    expect(R.getReglementsSupprimes(ANNEE_TEST).map((v) => [v.reglementId, v.numero, v.action])).toEqual([[id, 2, "suppression"]]);
    const v1 = R.getHistoriqueReglement(id).find((v) => v.numero === 1)!;
    const res = R.enregistrerReglement({ nom: v1.nom, annee: v1.annee, filiereIds: v1.filiereIds, formules: v1.formules }, id, "Test", { depuisVersion: 1 });
    expect(res.reglement?.id).toBe(id);
    expect(noteEc1()).toBeCloseTo(12.8, 9);
    expect(R.getReglementsSupprimes(ANNEE_TEST)).toEqual([]);
    expect(R.getHistoriqueReglement(id).map((v) => v.action)).toEqual(["retour", "suppression", "creation"]);
  });

  it("un règlement créé avant l'historique reçoit une version de départ", async () => {
    const { e, R, master } = await etablissement();
    const id = R.enregistrerReglement({ nom: "Ancien", annee: ANNEE_TEST, filiereIds: [e.classe.filiereId], formules: master }, undefined, "Awa NDIAYE").reglement!.id;
    localStorage.removeItem("edumanage-reglements-historique-v1");
    vi.resetModules();
    const R2 = await import("@/data/reglementCalculStore");
    const versions = R2.getHistoriqueReglement(id);
    expect(versions.map((v) => [v.numero, v.action, v.par, v.formules.noteEc])).toEqual([[1, "reprise", "Awa NDIAYE", master.noteEc]]);
  });
});
