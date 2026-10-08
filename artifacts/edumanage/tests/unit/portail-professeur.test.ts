import { afterEach, describe, expect, it, vi } from "vitest";
import { ANNEE_TEST, preparerEtablissement } from "../fixtures/etablissement";

/** Awa SECK en L3, son compte étudiant, et le compte professeur de Mamadou KANE. */
async function avecKane() {
  const e = await preparerEtablissement();
  const awa = e.inscrire("Awa", "SECK");
  const compteAwa = e.S.getUserAccounts().find((u) => u.linkedId === awa.id)!;
  const compteKane = e.S.creerCompteStaff({ role: "teacher", prenom: "Mamadou", nom: "KANE", identifier: "PROF-KANE", email: "kane@test.sn", password: "Professeur2026", linkedId: e.prof.id }, e.admin.id);
  const ec = e.ecsDe(e.uesDu("S5")[0].id)[0];
  return { ...e, awa, compteAwa, compteKane, ec };
}

type Contexte = Awaited<ReturnType<typeof avecKane>>;

function evaluationDe(e: Contexte, ecId: string) {
  return e.S.getNotes().find((n) => n.ecId === ecId && n.etudiantId === e.awa.id)!.evaluationId!;
}

function messages(e: Contexte, userId: string) {
  return e.S.getNotificationsByUser(userId).map((n) => n.message);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("notes officielles : verrou et demande de correction", () => {
  it("le professeur ne réécrit pas une note publiée, ni ne la remet en brouillon", async () => {
    const e = await avecKane();
    e.noter(e.awa.id, e.ec.id, "examen", 14, 100);
    const evaluationId = evaluationDe(e, e.ec.id);
    e.S.saveNoteEvaluationGrid(e.classe.id, e.ec.id, e.ec.libelle, evaluationId, "examen", undefined, [{ etudiantId: e.awa.id, note: 10 }], false, { respecterVerrou: true });
    const note = e.S.getNotes().find((n) => n.evaluationId === evaluationId && n.etudiantId === e.awa.id)!;
    expect(note.note).toBe(14);
    expect(note.statut).toBe("publie");
  });

  it("refuse une note hors barème et retire une note en brouillon dont la case est vidée", async () => {
    const e = await avecKane();
    const fatou = e.inscrire("Fatou", "DIOP");
    e.noter(fatou.id, e.ec.id, "examen", 11, 100);
    const evaluationId = e.S.getNotes().find((n) => n.etudiantId === fatou.id)!.evaluationId!;
    const enregistrer = (inputs: { etudiantId: string; note?: number; absent?: boolean }[]) =>
      e.S.saveNoteEvaluationGrid(e.classe.id, e.ec.id, e.ec.libelle, evaluationId, "examen", undefined, inputs, false, { bareme: 20, respecterVerrou: true });

    expect(() => enregistrer([{ etudiantId: e.awa.id, note: 25 }])).toThrow(/Awa SECK : 25 — elle doit être comprise entre 0 et 20/);
    expect(() => enregistrer([{ etudiantId: e.awa.id, note: -1 }])).toThrow(/comprise entre 0 et 20/);
    expect(e.S.getNotes().some((n) => n.etudiantId === e.awa.id)).toBe(false);

    enregistrer([{ etudiantId: e.awa.id, note: 12.5 }]);
    expect(e.S.getNotes().find((n) => n.etudiantId === e.awa.id)).toMatchObject({ note: 12.5, statut: "brouillon_prof" });
    enregistrer([{ etudiantId: e.awa.id, note: undefined }]);
    expect(e.S.getNotes().some((n) => n.etudiantId === e.awa.id)).toBe(false);
    // La note publiée de Fatou n'est pas touchée par une case vide.
    enregistrer([{ etudiantId: fatou.id, note: undefined }]);
    expect(e.S.getNotes().find((n) => n.etudiantId === fatou.id)).toMatchObject({ note: 11, statut: "publie" });
  });

  it("demande → acceptation : la note change, le journal garde l'ancienne valeur, Awa est prévenue", async () => {
    const e = await avecKane();
    const C = await import("@/data/correctionNoteStore");
    e.noter(e.awa.id, e.ec.id, "examen", 14, 100);
    const note = e.S.getNotes().find((n) => n.etudiantId === e.awa.id && n.ecId === e.ec.id)!;
    const demander = (nouvelleNote: number, motif: string) => C.demanderCorrectionNote({ noteId: note.id, nouvelleNote, motif }, e.compteKane.id);

    expect(() => demander(15, "  ")).toThrow(/motif/);
    expect(() => demander(25, "Erreur de report")).toThrow(/comprise entre 0 et 20/);
    expect(() => demander(14, "Erreur de report")).toThrow(/identique/);
    const demande = demander(15, "Erreur de report : 15 sur la copie");
    expect(() => demander(16, "Autre")).toThrow(/déjà en attente/);

    // Tant que la scolarité n'a pas décidé, la note publiée ne bouge pas.
    expect(e.S.getNotes().find((n) => n.id === note.id)!.note).toBe(14);
    expect(messages(e, e.admin.id).some((m) => /Correction de note demandée par Mamadou KANE : Awa SECK/.test(m))).toBe(true);
    expect(e.S.getAuditLogs().some((l) => l.action === "demande_correction_note" && l.targetId === note.id)).toBe(true);

    expect(() => C.traiterDemandeCorrection(demande.id, "refuser", e.admin.id, "")).toThrow(/motif du refus/);
    C.traiterDemandeCorrection(demande.id, "accepter", e.admin.id);
    const corrigee = e.S.getNotes().find((n) => n.id === note.id)!;
    expect(corrigee).toMatchObject({ note: 15, statut: "publie" });
    const journal = e.S.getAuditLogs().find((l) => l.action === "correction_note" && l.targetId === note.id)!;
    expect(journal.meta).toMatch(/14 → 15 — motif : Erreur de report : 15 sur la copie \(demande de Mamadou KANE\)/);
    expect(messages(e, e.compteAwa.id).some((m) => /^Note corrigée — .* : 14 → 15\.$/.test(m))).toBe(true);
    expect(messages(e, e.compteKane.id).some((m) => /demande de correction a été acceptée/.test(m))).toBe(true);
    expect(() => C.traiterDemandeCorrection(demande.id, "refuser", e.admin.id, "Trop tard")).toThrow(/déjà été traitée/);
  });

  it("jury clôturé : la correction attend la réouverture ; un refus est motivé et le professeur le voit", async () => {
    const e = await avecKane();
    const C = await import("@/data/correctionNoteStore");
    const D = await import("@/data/deliberationStore");
    const Rv = await import("@/data/reglesValidationStore");
    for (const ue of e.uesDu("S5")) for (const ec of e.ecsDe(ue.id)) e.noter(e.awa.id, ec.id, "examen", 12, 100);
    const sem = e.semestreDe("S5");
    const d = D.chargerDeliberation({ filiereId: e.classe.filiereId, filiere: e.classe.filiere, annee: ANNEE_TEST, niveauAlias: "L3", niveauLabel: "Licence 3", classeId: e.classe.id, classe: e.classe.nom, semestreId: sem.id, semestreAlias: "S5", semestreLabel: "Semestre 5 (S5)", etudiants: [{ id: e.awa.id, prenom: "Awa", nom: "SECK", matricule: e.awa.matricule }], regle: Rv.getRegleValidation(e.classe.filiereId, "semestre")!, effectuePar: "Test" });
    D.cloturerDeliberation(d.id);

    const note = e.S.getNotes().find((n) => n.etudiantId === e.awa.id && n.ecId === e.ec.id)!;
    const demande = C.demanderCorrectionNote({ noteId: note.id, nouvelleNote: 13, motif: "Point oublié" }, e.compteKane.id);
    expect(() => C.traiterDemandeCorrection(demande.id, "accepter", e.admin.id)).toThrow(/jury de ce semestre est clôturé/);
    expect(e.S.getNotes().find((n) => n.id === note.id)!.note).toBe(12);

    C.traiterDemandeCorrection(demande.id, "refuser", e.admin.id, "Jury clôturé, voir en réclamation");
    expect(C.getDemandesCorrection()[0]).toMatchObject({ statut: "refusee", motifRefus: "Jury clôturé, voir en réclamation" });
    expect(messages(e, e.compteKane.id).some((m) => /refusée : Awa SECK .* motif : Jury clôturé/.test(m))).toBe(true);
  });
});

describe("étudiant absent à une évaluation", () => {
  it("« ABS » est compté 0 dans la moyenne, comme un 0 saisi", async () => {
    const e = await avecKane();
    const fatou = e.inscrire("Fatou", "DIOP");
    e.noter(fatou.id, e.ec.id, "examen", 0, 100);
    const evaluationId = e.S.getNotes().find((n) => n.etudiantId === fatou.id)!.evaluationId!;
    e.S.saveNoteEvaluationGrid(e.classe.id, e.ec.id, e.ec.libelle, evaluationId, "examen", undefined, [{ etudiantId: e.awa.id, absent: true }], false, { respecterVerrou: true });
    e.S.submitNotesForValidation(e.classe.id, e.ec.id);
    e.S.validateNotesByAdmin(e.classe.id, e.ec.id, e.admin.id);
    e.S.publishNotesForClasseEc(e.classe.id, e.ec.id);
    for (const ue of e.uesDu("S5")) for (const ec of e.ecsDe(ue.id)) {
      if (ec.id === e.ec.id) continue;
      e.noter(e.awa.id, ec.id, "examen", 12, 100);
      e.noter(fatou.id, ec.id, "examen", 12, 100);
    }

    const abs = e.S.getNotes().find((n) => n.etudiantId === e.awa.id && n.ecId === e.ec.id)!;
    expect(abs).toMatchObject({ note: 0, absent: true, statut: "publie" });
    const { valeurNote } = await import("@/lib/portailEtudiant");
    expect(valeurNote(abs)).toBe("ABS (0)");

    const { computeBulletin } = await import("@/data/bulletinEngine");
    const awa = computeBulletin(e.awa.id, e.classe.id, e.classe.filiereId, "L3", "S5");
    const zero = computeBulletin(fatou.id, e.classe.id, e.classe.filiereId, "L3", "S5");
    expect(awa.moyenneSession).toBeDefined();
    expect(awa.moyenneSession).toBeLessThan(12);
    expect(awa.moyenneSession).toBe(zero.moyenneSession);
  });
});

describe("cahier de séance", () => {
  function seance(e: Contexte, semaineDu: string, jour: number) {
    const { seance } = e.S.addSeance({ ecId: e.ec.id, classeId: e.classe.id, salleId: e.St.getSalles()[0].id, prof: "Mamadou KANE", profId: e.prof.id, jour, semaineDu, heureDebut: "08:00", heureFin: "10:00", type: "CM" });
    return seance!;
  }
  const soumettre = (e: Contexte, seanceId: string, date: string, extra: { asDraft?: boolean; etatSeance?: "preparee" | "realisee" } = {}) =>
    e.S.submitCahierSeance({
      seanceId, prof: "Mamadou KANE", date, sujet: "Cours", resume: "Résumé",
      presences: [{ etudiantId: e.awa.id, nom: "Awa SECK", statut: "absent" }],
      etatSeance: extra.etatSeance ?? "realisee", asDraft: extra.asDraft,
    });

  it("est daté du jour de la séance, et un seul cahier est soumis par séance", async () => {
    const e = await avecKane();
    const mardi = seance(e, "2026-01-12", 2);
    expect(e.S.dateDeLaSeance(mardi)).toBe("2026-01-13");
    expect(() => soumettre(e, mardi.id, "2026-01-14")).toThrow(/doit être celle de la séance : le 13\/01\/2026/);

    const premier = soumettre(e, mardi.id, "2026-01-13");
    expect(() => soumettre(e, mardi.id, "2026-01-13")).toThrow(/déjà été soumis pour cette séance le 13\/01\/2026/);
    // L'absence d'Awa n'est comptée qu'une fois.
    const A = await import("@/data/assiduiteEngine");
    expect(A.getTauxPresencePourEtudiant(e.awa.id)).toEqual({ present: 0, total: 1, pct: 0 });

    // Un cahier rejeté par la scolarité peut être refait.
    e.S.validateCahier(premier.id, e.admin.id, false);
    expect(() => soumettre(e, mardi.id, "2026-01-13")).not.toThrow();
  });

  it("le cahier du professeur reste possible après une saisie de secours de l'administration", async () => {
    const e = await avecKane();
    const lundi = seance(e, "2026-01-12", 1);
    e.S.creerCahierSecoursAdmin(lundi.id, "2026-01-12", [{ etudiantId: e.awa.id, nom: "Awa SECK", statut: "present" }], "Scolarité");
    expect(() => soumettre(e, lundi.id, "2026-01-12")).not.toThrow();
  });

  it("une séance à venir ne peut pas être déclarée « réalisée »", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-10T10:00:00"));
    const e = await avecKane();
    const lundi = seance(e, "2026-01-12", 1);
    expect(() => soumettre(e, lundi.id, "2026-01-12")).toThrow(/n'a pas encore eu lieu/);
    expect(() => soumettre(e, lundi.id, "2026-01-12", { asDraft: true })).not.toThrow();
    expect(() => soumettre(e, lundi.id, "2026-01-12", { etatSeance: "preparee" })).not.toThrow();
  });
});

describe("démarches du professeur", () => {
  it("une seule demande de rallonge en attente par cours", async () => {
    const e = await avecKane();
    const R = await import("@/data/rallongeStore");
    const demande = () => R.addRallonge({ teacherId: e.prof.id, ecId: e.ec.id, classeId: e.classe.id, annee: ANNEE_TEST, vhActuel: 20, vhSupplementaire: 4, motif: "Retard du programme", origine: "prof" });
    const premiere = demande();
    expect(demande).toThrow(/déjà en attente pour ce cours/);
    R.updateRallongeStatut(premiere.id, "rejete", "Non justifié");
    expect(demande).not.toThrow();
  });

  it("un professeur ne supprime que ses propres ressources ; l'administration peut tout retirer", async () => {
    const e = await avecKane();
    const T = await import("@/data/teacherStore");
    const P = await import("@/data/ressourcePedagogiqueStore");
    const fall = T.addTeacher({ prenom: "Ibrahima", nom: "FALL", matricule: "ENS-TEST-2", telephone: "770000001", specialite: "Droit", grade: "Vacataire", tauxHoraire: 10000, email: "fall@test.sn", sexe: "M" }, e.admin.id);
    const compteFall = e.S.creerCompteStaff({ role: "teacher", prenom: "Ibrahima", nom: "FALL", identifier: "PROF-FALL", email: "fall@test.sn", password: "Professeur2026", linkedId: fall.id }, e.admin.id);
    const ajouter = (par: string, id: string) => P.addRessourcePedagogique({ classeId: e.classe.id, classe: e.classe.nom, titre: `Support ${par}`, url: "https://www.iso.org", ajoutePar: par }, id);

    const deKane = ajouter("Mamadou KANE", e.compteKane.id);
    const deLAdmin = ajouter("Scolarité", e.admin.id);
    expect(() => P.deleteRessourcePedagogique(deKane.id, compteFall.id)).toThrow(/que les ressources que vous avez déposées/);
    expect(() => P.deleteRessourcePedagogique(deLAdmin.id, e.compteKane.id)).toThrow(/que les ressources que vous avez déposées/);
    P.deleteRessourcePedagogique(deKane.id, e.compteKane.id);
    P.deleteRessourcePedagogique(deLAdmin.id, e.admin.id);
    expect(P.getRessourcesPedagogiques()).toHaveLength(0);
  });

  it("absence constatée → justificatif → refus motivé → nouveau justificatif → justifiée", async () => {
    const e = await avecKane();
    const A = await import("@/data/teacherAbsenceStore");
    const absence = A.addTeacherAbsence({ teacherId: e.prof.id, ecId: e.ec.id, classeId: e.classe.id, annee: ANNEE_TEST, date: "2026-01-20", type: "absence", motif: "", justifie: false, createdBy: e.admin.id });
    const statut = () => A.statutJustificationAbsence(A.getTeacherAbsences().find((a) => a.id === absence.id)!);
    expect(statut()).toBe("non_justifiee");

    expect(() => A.envoyerJustificatifAbsence(absence.id, { motif: " " }, e.compteKane.id)).toThrow(/raison/);
    A.envoyerJustificatifAbsence(absence.id, { motif: "Malade", pieceJointe: { nom: "certificat.pdf", dataUrl: "data:application/pdf;base64,AA==" } }, e.compteKane.id);
    expect(statut()).toBe("justificatif_envoye");
    expect(() => A.envoyerJustificatifAbsence(absence.id, { motif: "Encore" }, e.compteKane.id)).toThrow(/déjà en attente/);
    expect(messages(e, e.admin.id).some((m) => /Justificatif reçu de Mamadou KANE pour son absence du 20\/01\/2026 : Malade/.test(m))).toBe(true);

    expect(() => A.deciderJustificatifAbsence(absence.id, "refuser", e.admin.id)).toThrow(/motif du refus/);
    A.deciderJustificatifAbsence(absence.id, "refuser", e.admin.id, "Certificat illisible");
    expect(statut()).toBe("justificatif_refuse");
    expect(messages(e, e.compteKane.id).some((m) => /Justificatif refusé .* motif : Certificat illisible/.test(m))).toBe(true);

    A.envoyerJustificatifAbsence(absence.id, { motif: "Malade (certificat lisible)" }, e.compteKane.id);
    A.deciderJustificatifAbsence(absence.id, "accepter", e.admin.id);
    expect(statut()).toBe("justifiee");
    expect(messages(e, e.compteKane.id).some((m) => /Justificatif accepté/.test(m))).toBe(true);
  });
});

describe("notifications du professeur", () => {
  it("chaque notification ouvre la bonne page du portail", async () => {
    const { lienNotificationProfesseur } = await import("@/lib/notificationsProfesseur");
    expect(lienNotificationProfesseur("Votre demande de correction a été acceptée : Awa SECK — Projet (Examen) 14,00 → 15,00.")).toBe("/teacher/grades");
    expect(lienNotificationProfesseur("Votre demande de rallonge a été validée")).toBe("/teacher/rallonge");
    expect(lienNotificationProfesseur("Nouveau décompte émis : 57 000 F CFA")).toBe("/teacher/remuneration");
    expect(lienNotificationProfesseur("Votre contrat 2025-2026 est disponible")).toBe("/teacher/contract");
    expect(lienNotificationProfesseur("Justificatif refusé pour votre absence du 20/01/2026")).toBe("/teacher/absences");
    expect(lienNotificationProfesseur("Votre cahier de séance a été rejeté")).toBe("/teacher/cahier");
    expect(lienNotificationProfesseur("Bienvenue")).toBeUndefined();
  });
});
