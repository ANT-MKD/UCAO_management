import { describe, expect, it, vi } from "vitest";
import { ANNEE_TEST, MOT_DE_PASSE_ADMIN, preparerEtablissement } from "../fixtures/etablissement";

/** Awa SECK en L3, avec un examen publié (12,6) dans le premier EC du S5. */
async function avecAwaNotee() {
  const e = await preparerEtablissement();
  const awa = e.inscrire("Awa", "SECK");
  const ue = e.uesDu("S5")[0];
  const ec = e.ecsDe(ue.id)[0];
  e.noter(awa.id, ec.id, "examen", 12.6, 60);
  const R = await import("@/data/suppressionReferentiel");
  return { ...e, awa, ue, ec, R };
}

describe("suppression d'un élément utilisé", () => {
  it("refuse de supprimer l'UE qui porte la note d'Awa, et dit pourquoi", async () => {
    const { R, C, ue, admin } = await avecAwaNotee();
    const v = R.verifierSuppressionUe(ue.id);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/^Suppression impossible : l'UE .+ est encore utilisée \(1 note, 1 évaluation\)/);
    expect(R.supprimerUe(ue.id, admin.id).ok).toBe(false);
    expect(C.getUes().some((u) => u.id === ue.id)).toBe(true);
  });

  it("refuse de supprimer la classe d'Awa et propose la clôture", async () => {
    const { R, St, classe, admin } = await avecAwaNotee();
    const r = R.supprimerClasse(classe.id, admin.id);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/1 étudiant inscrit/);
    expect(r.reason).toMatch(/Clôture année/);
    expect(St.getClasses().some((c) => c.id === classe.id)).toBe(true);
  });

  it("supprime une UE inutilisée et l'inscrit au journal", async () => {
    const { R, C, S, uesDu, admin } = await avecAwaNotee();
    const libre = uesDu("S6")[0];
    expect(R.verifierSuppressionUe(libre.id).ok).toBe(true);
    expect(R.supprimerUe(libre.id, admin.id).ok).toBe(true);
    expect(C.getUes().some((u) => u.id === libre.id)).toBe(false);
    expect(S.getAuditLogs().some((l) => l.action === "suppression_ue" && l.targetId === libre.id && l.actorUserId === admin.id)).toBe(true);
  });
});

describe("évaluations et notes publiées", () => {
  it("refuse de supprimer l'examen dont la note d'Awa est publiée", async () => {
    const { R, ec, admin } = await avecAwaNotee();
    const Ev = await import("@/data/evaluationStore");
    const examen = Ev.getEvaluations().find((x) => x.ecId === ec.id)!;
    const r = R.supprimerEvaluation(examen.id, admin.id);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/1 note de cette évaluation est validée ou publiée/);
    expect(Ev.getEvaluations().some((x) => x.id === examen.id)).toBe(true);
  });

  it("une évaluation sans note officielle part avec ses brouillons", async () => {
    const { R, S, awa, ec, classe, niveau, prof, semestreDe, admin } = await avecAwaNotee();
    const Ev = await import("@/data/evaluationStore");
    const sem = semestreDe("S5");
    const devoir = Ev.createEvaluation({ filiereId: classe.filiereId, annee: ANNEE_TEST, niveauId: niveau.id, niveau: niveau.alias, classeId: classe.id, semestreId: sem.id, semestre: sem.alias, ecId: ec.id, professeurId: prof.id, professeur: "Mamadou KANE", type: "devoir", poids: 40 });
    S.saveNoteEvaluationGrid(classe.id, ec.id, ec.libelle, devoir.id, "devoir", undefined, [{ etudiantId: awa.id, note: 9 }], false);
    expect(S.getNotesEvaluation(devoir.id)).toHaveLength(1);
    expect(R.verifierSuppressionEvaluation(devoir.id)).toEqual({ ok: true, notesBrouillon: 1 });
    expect(R.supprimerEvaluation(devoir.id, admin.id).ok).toBe(true);
    expect(S.getNotesEvaluation(devoir.id)).toHaveLength(0);
    expect(Ev.getEvaluations().some((x) => x.id === devoir.id)).toBe(false);
  });

  it("supprimer la note publiée d'Awa exige un motif et laisse une trace avec l'ancienne valeur", async () => {
    const { S, awa, admin } = await avecAwaNotee();
    const note = S.getNotes().find((n) => n.etudiantId === awa.id)!;
    expect(() => S.deleteNote(note.id, admin.id)).toThrow(/motif/);
    expect(() => S.deleteNote(note.id, admin.id, "   ")).toThrow(/motif/);
    expect(S.getNotes().some((n) => n.id === note.id)).toBe(true);

    S.deleteNote(note.id, admin.id, "Copie attribuée à la mauvaise étudiante");
    expect(S.getNotes().some((n) => n.id === note.id)).toBe(false);
    const trace = S.getAuditLogs().find((l) => l.action === "suppression_note" && l.targetId === note.id)!;
    expect(trace.actorUserId).toBe(admin.id);
    expect(trace.meta).toMatch(/Awa SECK \(2025-[A-Z]+-0001\)/);
    expect(trace.meta).toMatch(/Examen : 12,6 \(publiée\)/);
    expect(trace.meta).toMatch(/motif : Copie attribuée à la mauvaise étudiante$/);
  });
});

/** Un second compte du portail admin, limité par le rôle ROLE_SECRETARIAT. */
async function avecSecretariat() {
  const e = await preparerEtablissement();
  const R = await import("@/data/roleStore");
  const sec = e.S.creerCompteStaff({ role: "admin", prenom: "Binta", nom: "SOW", identifier: "SEC-SOW", email: "sow@test.sn", password: "Provisoire1", roleId: "role-secretariat" }, e.admin.id);
  return { ...e, R, sec };
}

describe("droits des comptes limités par un rôle", () => {
  it("seul un administrateur à accès complet gère les rôles", async () => {
    const { R, admin, sec } = await avecSecretariat();
    expect(() => R.upsertRole({ code: "ROLE_X", description: "x" }, sec.id)).toThrow(/accès complet/);
    expect(() => R.setRoleAccess("role-secretariat", ["sec-reset-donnees"], sec.id)).toThrow(/accès complet/);
    expect(() => R.deleteRole("role-comptable", sec.id)).toThrow(/accès complet/);
    expect(R.getRoles().some((r) => r.id === "role-comptable")).toBe(true);

    const role = R.upsertRole({ code: "ROLE_X", description: "x" }, admin.id);
    R.setRoleAccess(role.id, ["sec-reset-donnees"], admin.id);
    R.deleteRole(role.id, admin.id);
    expect(R.getRoles().some((r) => r.id === role.id)).toBe(false);
  });

  it("un compte limité ne s'élève pas et ne touche pas aux administrateurs principaux", async () => {
    const { S, admin, sec } = await avecSecretariat();
    const infos = (u: { displayName: string; email: string }, roleId?: string) => ({ displayName: u.displayName, email: u.email, roleId });
    expect(() => S.updateUserAccountInfo(sec.id, infos(sec), sec.id)).toThrow(/propre rôle/);
    expect(() => S.updateUserAccountInfo(sec.id, infos(sec, "role-direction"), sec.id)).toThrow(/propre rôle/);
    // Deux administrateurs principaux : la règle « il en reste toujours un » ne joue pas ici.
    S.creerCompteStaff({ role: "admin", prenom: "Ibou", nom: "DIOP", identifier: "ADM-DIOP", email: "diop@test.sn", password: "Provisoire1" }, admin.id);
    expect(() => S.updateUserAccountInfo(admin.id, infos(admin, "role-comptable"), sec.id)).toThrow(/seul un administrateur à accès complet peut le modifier/);
    expect(() => S.updateUserAccountInfo(admin.id, infos({ displayName: "X", email: "x@test.sn" }), sec.id)).toThrow(/peut le modifier/);
    expect(() => S.setUserAccountActif(admin.id, false, sec.id)).toThrow(/seul un administrateur à accès complet peut le bloquer/);
    expect(S.getUserAccountById(admin.id)).toMatchObject({ actif: true, email: "scolarite@test.sn" });
    expect(() => S.creerCompteStaff({ role: "admin", prenom: "A", nom: "B", identifier: "ADM-B", email: "b@test.sn", password: "Provisoire1" }, sec.id)).toThrow(/sans rôle/);
    expect(S.getUserAccountById(sec.id)?.roleId).toBe("role-secretariat");
    expect(S.aAccesComplet(admin.id)).toBe(true);

    // Ce que son rôle lui permet toujours : créer un compte avec un rôle, modifier ses propres infos.
    expect(S.creerCompteStaff({ role: "admin", prenom: "A", nom: "B", identifier: "ADM-B", email: "b@test.sn", password: "Provisoire1", roleId: "role-comptable" }, sec.id).roleId).toBe("role-comptable");
    S.updateUserAccountInfo(sec.id, infos({ displayName: "Binta SOW", email: "binta@test.sn" }, "role-secretariat"), sec.id);
    expect(S.getUserAccountById(sec.id)?.email).toBe("binta@test.sn");
  });

  it("il reste toujours un administrateur à accès complet", async () => {
    const { S, admin } = await avecSecretariat();
    expect(() => S.setUserAccountActif(admin.id, false, admin.id)).toThrow(/dernier/);
    expect(() => S.updateUserAccountInfo(admin.id, { displayName: "Awa Ndiaye", email: "scolarite@test.sn", roleId: "role-direction" }, admin.id)).toThrow(/dernier/);
    const second = S.creerCompteStaff({ role: "admin", prenom: "Ibou", nom: "DIOP", identifier: "ADM-DIOP", email: "diop@test.sn", password: "Provisoire1" }, admin.id);
    expect(S.aAccesComplet(second.id)).toBe(true);
    S.setUserAccountActif(admin.id, false, second.id);
    expect(S.getUserAccountById(admin.id)?.actif).toBe(false);
  });
});

describe("réinitialisation des données", () => {
  it("réservée à un administrateur à accès complet qui donne son mot de passe", async () => {
    const { S, admin, sec, inscrire } = await avecSecretariat();
    inscrire("Awa", "SECK");
    S.definirMotDePasseDefinitif(sec.id, "Secretariat2026");
    const { resetTestData } = await import("@/lib/dataReset");
    expect(() => resetTestData(sec.id, "Secretariat2026")).toThrow(/accès complet/);
    expect(() => resetTestData(admin.id, "mauvais")).toThrow(/Mot de passe incorrect/);
    expect(S.getEtudiants()).toHaveLength(1);

    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    try {
      resetTestData(admin.id, MOT_DE_PASSE_ADMIN);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(S.getEtudiants()).toHaveLength(0);
    expect(S.getUserAccounts().map((u) => u.id)).toEqual([admin.id]);
    expect(S.getAuditLogs().map((l) => l.action)).toEqual(["reinitialisation_donnees"]);
  });
});

describe("notifications", () => {
  const JOUR = 24 * 3600 * 1000;
  const maintenant = Date.parse("2026-10-08T12:00:00Z");
  const il_y_a = (jours: number) => new Date(maintenant - jours * JOUR).toISOString();

  it("celles lues depuis plus de 90 jours sont purgées ; non lues et archivées restent", async () => {
    const { purgerNotificationsLues } = await import("@/data/studentStore");
    const n = (id: string, x: object) => ({ id, userId: "u", message: id, createdAt: il_y_a(200), read: false, ...x });
    const gardees = purgerNotificationsLues([
      n("lue-recemment", { read: true, readAt: il_y_a(10) }),
      n("lue-il-y-a-100-jours", { read: true, readAt: il_y_a(100) }),
      n("ancienne-lue-sans-date", { read: true }),
      n("ancienne-non-lue", {}),
      n("archivee", { read: true, readAt: il_y_a(150), archived: true }),
    ], maintenant).map((x) => x.id);
    expect(gardees).toEqual(["lue-recemment", "ancienne-non-lue", "archivee"]);
  });

  it("la purge s'applique au chargement de l'application", async () => {
    const { S, inscrire } = await preparerEtablissement();
    const awa = inscrire("Awa", "SECK");
    const compte = S.getUserAccounts().find((u) => u.linkedId === awa.id)!;
    S.pushNotificationEtPersister(compte.id, "Vos notes du S5 sont publiées.");
    S.markAllNotificationsRead(compte.id);
    expect(S.getNotificationsByUser(compte.id)[0].readAt).toBeTruthy();
    const brut = JSON.parse(localStorage.getItem("edumanage-app-store-v2")!);
    const total = brut.notifications.length;
    brut.notifications = brut.notifications.map((x: { userId: string }) => (x.userId === compte.id ? { ...x, readAt: "2020-01-01T00:00:00.000Z" } : x));
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify(brut));
    vi.resetModules();
    const S2 = await import("@/data/studentStore");
    expect(S2.getNotificationsByUser(compte.id)).toHaveLength(0);
    expect(S2.getNotifications().length).toBeLessThan(total);
  });
});

describe("décompte au taux horaire des vacataires", () => {
  /** KANE (10 000 F/h sur sa fiche) a donné 2 h de cours, pointées et validées. */
  async function avecPointage(statut: "valide" | "soumis" = "valide") {
    const e = await preparerEtablissement();
    const ec = e.ecsDe(e.uesDu("S5")[0].id)[0];
    const salle = e.St.getSalles()[0];
    e.S.addSeance({ ecId: ec.id, classeId: e.classe.id, prof: "Mamadou KANE", profId: e.prof.id, jour: 1, semaineDu: "2026-01-05", heureDebut: "08:00", heureFin: "10:00", type: "CM", salleId: salle.id });
    const P = await import("@/data/pointageStore");
    P.addPointage({ id: P.makePointageId(), teacherId: e.prof.id, ecId: ec.id, classeId: e.classe.id, annee: ANNEE_TEST, date: "2026-01-05", heureDebut: "08:00", heureFin: "10:00", type: "CM", salleId: salle.id, volumePointe: 2, statut, createdAt: new Date().toISOString() });
    const Rt = await import("@/data/teacherRateStore");
    const T = await import("@/data/teacherStore");
    const { analyserDecompteTauxHoraire } = await import("@/lib/decompteEligibility");
    const { getTeacherCourseStatuses } = await import("@/data/teacherCourseStatusStore");
    const analyser = () => {
      const prof = T.getTeachers().find((t) => t.id === e.prof.id)!;
      return analyserDecompteTauxHoraire(prof, e.S.getSeances(), e.C.getEcs(), e.C.getUes(), e.St.getClasses(), ANNEE_TEST, Rt.getTeacherRates(), getTeacherCourseStatuses(), P.getPointages(), new Set());
    };
    const fixerTaux = (modePaiement: "taux_horaire" | "forfait", montant: number) =>
      Rt.upsertTeacherRate({ id: Rt.makeTeacherRateId(e.prof.id, ec.id, e.classe.id, ANNEE_TEST), teacherId: e.prof.id, ecId: ec.id, classeId: e.classe.id, annee: ANNEE_TEST, modePaiement, montant, tauxAbatt: 5 });
    return { ...e, T, analyser, fixerTaux };
  }

  it("sans taux saisi pour le cours, le taux de la fiche s'applique (2 h × 10 000 F − 5 %)", async () => {
    const { analyser } = await avecPointage();
    const { lines } = analyser();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ duree: 2, tauxHoraire: 10000, sourceTaux: "fiche", montantBrut: 20000, abattementPct: 5, abattementMontant: 1000, montantNet: 19000 });
  });

  it("le taux saisi pour le cours l'emporte sur la fiche", async () => {
    const { analyser, fixerTaux } = await avecPointage();
    fixerTaux("taux_horaire", 12000);
    expect(analyser().lines[0]).toMatchObject({ tauxHoraire: 12000, sourceTaux: "cours", montantBrut: 24000, montantNet: 22800 });
  });

  it("diagnostic : cours payé au forfait", async () => {
    const { analyser, fixerTaux } = await avecPointage();
    fixerTaux("forfait", 300000);
    expect(analyser()).toMatchObject({ lines: [], diagnostic: { forfait: 1, sansTaux: 0 } });
  });

  it("diagnostic : aucun taux, ni pour le cours ni sur la fiche", async () => {
    const { analyser, T, prof } = await avecPointage();
    T.getTeachers().find((t) => t.id === prof.id)!.tauxHoraire = 0;
    expect(analyser()).toMatchObject({ lines: [], diagnostic: { sansTaux: 1, forfait: 0 } });
  });

  it("diagnostic : pointage pas encore validé", async () => {
    const { analyser } = await avecPointage("soumis");
    expect(analyser()).toMatchObject({ lines: [], diagnostic: { enAttente: 1, sansTaux: 0 } });
  });
});
