import { describe, expect, it } from "vitest";
import { preparerEtablissement } from "../fixtures/etablissement";

async function planifier() {
  const e = await preparerEtablissement();
  const T = await import("@/data/teacherStore");
  const homonyme = T.addTeacher({ prenom: "Mamadou", nom: "KANE", matricule: "ENS-TEST-2", telephone: "770000001", specialite: "QHSE", grade: "Vacataire", tauxHoraire: 10000, email: "kane2@test.sn", sexe: "M" }, e.admin.id);
  const [ec] = e.ecsDe(e.uesDu("S5")[0].id);
  const salles = e.St.getSalles();
  const base = { ecId: ec.id, classeId: e.classe.id, prof: "Mamadou KANE", jour: 1, semaineDu: "2026-01-05", heureDebut: "08:00", heureFin: "10:00", type: "CM" };
  const r = e.S.addSeance({ ...base, salleId: salles[0].id, profId: e.prof.id });
  return { e, ec, salles, base, homonyme, seance: r.seance! };
}

describe("emploi du temps", () => {
  it("détecte les conflits de salle, de classe et de professeur", async () => {
    const { e, salles, base } = await planifier();
    expect(e.S.addSeance({ ...base, salleId: salles[0].id, profId: e.prof.id }).conflicts.map((c) => c.type).sort()).toEqual(["classe", "prof", "salle"]);
  });

  it("ne confond pas deux professeurs homonymes", async () => {
    const { e, salles, base, homonyme } = await planifier();
    const autreClasse = e.St.getClasses().find((c) => c.id !== e.classe.id)!;
    const r = e.S.addSeance({ ...base, classeId: autreClasse.id, salleId: salles[1].id, profId: homonyme.id });
    expect(r.conflicts).toHaveLength(0);
  });

  it("modifier une séance prévient la classe et refuse un conflit", async () => {
    const { e, salles, seance, base } = await planifier();
    const awa = e.inscrire("Awa", "SECK");
    const compte = e.S.getUserAccounts().find((u) => u.linkedId === awa.id)!;
    const ok = e.S.modifierSeance(seance.id, { ...base, salleId: salles[1].id, profId: e.prof.id, jour: 2, heureDebut: "10:00", heureFin: "12:00" }, e.admin.id);
    expect(ok.ok).toBe(true);
    expect(e.S.getNotificationsByUser(compte.id)[0].message).toMatch(/Cours modifié/);
  });

  it("une séance avec cahier soumis ne peut plus être modifiée ni annulée", async () => {
    const { e, seance, base, salles } = await planifier();
    const awa = e.inscrire("Awa", "SECK");
    e.S.submitCahierSeance({ seanceId: seance.id, prof: "Mamadou KANE", date: "2026-01-05", sujet: "Intro", resume: "Cours 1", presences: [{ etudiantId: awa.id, nom: "Awa SECK", statut: "present" }], etatSeance: "realisee" });
    expect(e.S.modifierSeance(seance.id, { ...base, salleId: salles[1].id, profId: e.prof.id }, e.admin.id).ok).toBe(false);
    expect(e.S.annulerSeance(seance.id, "test", e.admin.id).ok).toBe(false);
  });

  it("un cahier validé crée le pointage à confirmer (2 h, une seule fois)", async () => {
    const { e, seance } = await planifier();
    const awa = e.inscrire("Awa", "SECK");
    const c = e.S.submitCahierSeance({ seanceId: seance.id, prof: "Mamadou KANE", date: "2026-01-05", sujet: "Intro", resume: "Cours 1", presences: [{ etudiantId: awa.id, nom: "Awa SECK", statut: "absent" }], etatSeance: "realisee" });
    const pointage = e.S.validateCahier(c.id, e.admin.id, true);
    expect(pointage?.volumePointe).toBe(2);
    const Pt = await import("@/data/pointageStore");
    expect(Pt.getPointages().filter((p) => p.cahierId === c.id && p.statut === "soumis")).toHaveLength(1);
    e.S.validateCahier(c.id, e.admin.id, true);
    expect(Pt.getPointages().filter((p) => p.cahierId === c.id)).toHaveLength(1);
  });
});
