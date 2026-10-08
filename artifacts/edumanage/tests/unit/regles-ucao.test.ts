import { describe, expect, it } from "vitest";
import { preparerEtablissement } from "../fixtures/etablissement";

/** Règles de calcul de l'UCAO (valeurs par défaut de l'application) : moyenne d'UE simple, UE
 * acquise à 10 avec tous ses crédits, semestre validé à 30 crédits, année à 60 avec passage avec
 * dette dès 42, rattrapage de toutes les matières d'une UE non acquise (meilleure note retenue),
 * repêchage d'UE par le jury, UE capitalisées pour un redoublant, pas d'arrondi. */
async function etablissement() {
  const e = await preparerEtablissement();
  const { computeBulletin, doitRattraperUe } = await import("@/data/bulletinEngine");
  const ueADeuxEc = e.uesDu("S5").find((u) => e.ecsDe(u.id).length >= 2)!;
  const bulletin = (etudiantId: string, classeId = e.classe.id) => computeBulletin(etudiantId, classeId, e.classe.filiereId, "L3", "S5");
  /** Note toutes les matières d'une UE avec la même note de devoir et d'examen (30 % / 70 %). */
  const noterUe = (etudiantId: string, ueId: string, note: number) => e.ecsDe(ueId).forEach((ec) => { e.noter(etudiantId, ec.id, "devoir", note, 30); e.noter(etudiantId, ec.id, "examen", note, 70); });
  return { e, bulletin, doitRattraperUe, ueADeuxEc, noterUe };
}

describe("règles UCAO — l'exemple d'Awa", () => {
  it("moyenne d'UE simple : Algèbre (6 cr.) 12,60 et Analyse (4 cr.) 7,30 donnent 9,95, UE non acquise", async () => {
    const { e, bulletin, ueADeuxEc } = await etablissement();
    const [ec1, ec2] = e.ecsDe(ueADeuxEc.id);
    // Crédits différents : une moyenne pondérée par crédits donnerait 10,48 (UE acquise).
    e.C.upsertEc({ ...ec1, credits: 6 }, ec1.id);
    e.C.upsertEc({ ...ec2, credits: 4 }, ec2.id);
    const awa = e.inscrire("Awa", "SECK");
    e.noter(awa.id, ec1.id, "devoir", 14, 30); e.noter(awa.id, ec1.id, "examen", 12, 70);
    e.noter(awa.id, ec2.id, "devoir", 8, 30); e.noter(awa.id, ec2.id, "examen", 7, 70);
    const ue = bulletin(awa.id).ues.find((u) => u.id === ueADeuxEc.id)!;
    expect(ue.ecs.find((l) => l.id === ec1.id)!.moyenne).toBeCloseTo(12.6, 9);
    expect(ue.ecs.find((l) => l.id === ec2.id)!.moyenne).toBeCloseTo(7.3, 9);
    expect(ue.moyenne).toBeCloseTo(9.95, 9);
    expect(ue.validee).toBe(false);
    expect(ue.creditsObtenus).toBe(0);
  });

  it("moyenne du semestre = moyenne simple de toutes les matières du semestre (pas des UE)", async () => {
    const { e, bulletin } = await etablissement();
    // Une UE à 3 matières : la moyenne des matières diffère alors de la moyenne des UE.
    const [premiere] = e.uesDu("S5");
    const [modele] = e.ecsDe(premiere.id);
    e.C.upsertEc({ ...modele, code: `${modele.code}X`, libelle: "Matière ajoutée", credits: 5 });
    const awa = e.inscrire("Awa", "SECK");
    let n = 0;
    for (const ue of e.uesDu("S5")) for (const ec of e.ecsDe(ue.id)) { const note = 6 + (n++ % 9); e.noter(awa.id, ec.id, "devoir", note, 30); e.noter(awa.id, ec.id, "examen", note, 70); }
    const b = bulletin(awa.id);
    const ecs = b.ues.flatMap((u) => u.ecs);
    const moyenneDesMatieres = ecs.reduce((s, l) => s + l.moyenne!, 0) / ecs.length;
    const moyenneDesUe = b.ues.reduce((s, u) => s + u.moyenne!, 0) / b.ues.length;
    expect(Math.abs(moyenneDesMatieres - moyenneDesUe)).toBeGreaterThan(0.01);
    expect(b.moyenneSession).toBeCloseTo(moyenneDesMatieres, 9);
  });

  it("une UE acquise rapporte tous ses crédits, une UE à 9,99 n'en rapporte aucun", async () => {
    const { e, bulletin, noterUe } = await etablissement();
    const awa = e.inscrire("Awa", "SECK");
    const [ue1, ue2] = e.uesDu("S5");
    noterUe(awa.id, ue1.id, 10);
    noterUe(awa.id, ue2.id, 9.99);
    const b = bulletin(awa.id);
    expect(b.ues.find((u) => u.id === ue1.id)!.creditsObtenus).toBe(ue1.credits);
    expect(b.ues.find((u) => u.id === ue2.id)!.creditsObtenus).toBe(0);
  });
});

describe("règles UCAO — semestre et année", () => {
  it("semestre validé seulement avec ses 30 crédits, quelle que soit la moyenne", async () => {
    const { e, bulletin, noterUe } = await etablissement();
    const Rv = await import("@/data/reglesValidationStore");
    const regle = Rv.getRegleValidation(e.classe.filiereId, "semestre")!;
    expect(regle.validationParCredit).toBe(true);
    expect(regle.validationParMoyenne).toBe(false);
    expect(regle.creditPassage).toBe(30);
    const awa = e.inscrire("Awa", "SECK");
    const [premiere, ...autres] = e.uesDu("S5");
    noterUe(awa.id, premiere.id, 8);
    autres.forEach((ue) => noterUe(awa.id, ue.id, 15));
    const b = bulletin(awa.id);
    expect(b.moyenneSession!).toBeGreaterThan(10);
    expect(Rv.decideValidation(b.moyenneSession!, b.creditsObtenus, 0, regle)).toBe("ajourne");
    expect(Rv.decideValidation(9, 30, 0, regle)).toBe("admis");
  });

  it("année : 60 crédits admis, de 42 à 59 avec dette, moins de 42 redouble ; les absences n'excluent personne", async () => {
    const { e } = await etablissement();
    const Rv = await import("@/data/reglesValidationStore");
    const { decideValidationAnnuelle } = await import("@/data/deliberationAnnuelleStore");
    const regle = Rv.getRegleValidation(e.classe.filiereId, "annee")!;
    expect(regle.creditPassage).toBe(60);
    // Niveau sans seuil propre : la règle de la filière (42 crédits) s'applique.
    const niveau = { ...e.niveau, passageConditionnelAutorise: false };
    expect(decideValidationAnnuelle(0, 60, 40, regle, niveau)).toBe("admis");
    expect(decideValidationAnnuelle(0, 59, 0, regle, niveau)).toBe("admis_avec_dette");
    expect(decideValidationAnnuelle(0, 42, 0, regle, niveau)).toBe("admis_avec_dette");
    expect(decideValidationAnnuelle(0, 41, 0, regle, niveau)).toBe("redouble");
    // Un niveau peut fixer son propre seuil de passage avec dette.
    expect(decideValidationAnnuelle(0, 45, 0, regle, { ...e.niveau, passageConditionnelAutorise: true, creditDetteMin: 50 })).toBe("redouble");
  });
});

describe("règles UCAO — rattrapage et repêchage", () => {
  it("toutes les matières d'une UE non acquise vont au rattrapage, même celle à 12,60", async () => {
    const { e, doitRattraperUe, ueADeuxEc } = await etablissement();
    const awa = e.inscrire("Awa", "SECK");
    const [ec1, ec2, ...autres] = e.ecsDe(ueADeuxEc.id);
    e.noter(awa.id, ec1.id, "devoir", 14, 30); e.noter(awa.id, ec1.id, "examen", 12, 70);
    e.noter(awa.id, ec2.id, "devoir", 4, 30); e.noter(awa.id, ec2.id, "examen", 4, 70);
    for (const ec of autres) { e.noter(awa.id, ec.id, "devoir", 4, 30); e.noter(awa.id, ec.id, "examen", 4, 70); }
    expect(doitRattraperUe(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5", ueADeuxEc.id)).toBe(true);
    // Une UE acquise ne va pas au rattrapage, même avec une matière sous 10.
    const fatou = e.inscrire("Fatou", "DIOP");
    e.noter(fatou.id, ec1.id, "devoir", 18, 30); e.noter(fatou.id, ec1.id, "examen", 18, 70);
    e.noter(fatou.id, ec2.id, "devoir", 8, 30); e.noter(fatou.id, ec2.id, "examen", 8, 70);
    for (const ec of autres) { e.noter(fatou.id, ec.id, "devoir", 18, 30); e.noter(fatou.id, ec.id, "examen", 18, 70); }
    expect(doitRattraperUe(fatou.id, e.classe.id, e.classe.filiereId, "L3", "S5", ueADeuxEc.id)).toBe(false);
  });

  it("la note de rattrapage remplace l'examen seulement si elle est meilleure", async () => {
    const { e, bulletin } = await etablissement();
    const awa = e.inscrire("Awa", "SECK");
    const moussa = e.inscrire("Moussa", "FALL");
    const [ec] = e.ecsDe(e.uesDu("S5")[0].id);
    e.noter(awa.id, ec.id, "devoir", 9, 30); e.noter(awa.id, ec.id, "examen", 6, 70);
    e.noter(awa.id, ec.id, "examen", 13, 70, "rattrapage");
    e.noter(moussa.id, ec.id, "devoir", 9, 30); e.noter(moussa.id, ec.id, "examen", 6, 70);
    e.noter(moussa.id, ec.id, "examen", 4, 70, "rattrapage");
    const ligne = (id: string) => bulletin(id).ues.flatMap((u) => u.ecs).find((l) => l.id === ec.id)!;
    expect(ligne(awa.id).ef).toBe(13);
    expect(ligne(awa.id).moyenne).toBeCloseTo(11.8, 9);
    expect(ligne(moussa.id).ef).toBe(6);
  });

  it("repêchage par le jury : l'UE devient acquise avec ses crédits, la vraie moyenne reste", async () => {
    const { e, bulletin, doitRattraperUe, noterUe } = await etablissement();
    const { repecherUe, annulerRepechage } = await import("@/data/repechageStore");
    const awa = e.inscrire("Awa", "SECK");
    const ue = e.uesDu("S5")[0];
    noterUe(awa.id, ue.id, 9.5);
    expect(bulletin(awa.id).ues[0].validee).toBe(false);
    expect(repecherUe({ etudiantId: awa.id, classeId: e.classe.id, ueId: ue.id, ueLibelle: ue.libelle, semestreAlias: "S5", moyenne: 9.5, absences: 0, motif: "", decidePar: e.admin.id }).ok).toBe(false);
    const res = repecherUe({ etudiantId: awa.id, classeId: e.classe.id, ueId: ue.id, ueLibelle: ue.libelle, semestreAlias: "S5", moyenne: 9.5, absences: 0, motif: "Étudiante assidue, aucune absence", decidePar: e.admin.id });
    expect(res.ok).toBe(true);
    const apres = bulletin(awa.id).ues[0];
    expect(apres.validee).toBe(true);
    expect(apres.valideeParJury?.motif).toBe("Étudiante assidue, aucune absence");
    expect(apres.creditsObtenus).toBe(ue.credits);
    expect(apres.moyenne).toBeCloseTo(9.5, 9);
    expect(doitRattraperUe(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5", ue.id)).toBe(false);
    annulerRepechage(res.record!.id, e.admin.id);
    expect(bulletin(awa.id).ues[0].validee).toBe(false);
  });
});

describe("règles UCAO — redoublement et passage", () => {
  it("un redoublant garde les UE déjà acquises", async () => {
    const { e, bulletin, noterUe } = await etablissement();
    const awa = e.inscrire("Awa", "SECK");
    const [ue1, ue2] = e.uesDu("S5");
    noterUe(awa.id, ue1.id, 14);
    noterUe(awa.id, ue2.id, 6);
    e.S.addAnneeAcademique("2026-2027", { dateDebut: "2026-11-02", dateFin: "2027-07-30" });
    const classe2 = e.St.upsertClasse({ nom: "L3 REDOUBLANTS", filiereId: e.classe.filiereId, niveauId: e.niveau.id, max: 30, annee: "2026-2027" });
    e.S.registerReinscription({ etudiantId: awa.id, annee: "2026-2027", filiereId: e.classe.filiereId, classeId: classe2.id, niveau: "L3", statut: "inscrit", soldeDu: 0 });
    const b = bulletin(awa.id, classe2.id);
    const acquise = b.ues.find((u) => u.id === ue1.id)!;
    expect(acquise.capitalisee?.annee).toBe("2025-2026");
    expect(acquise.creditsObtenus).toBe(ue1.credits);
    expect(acquise.moyenne).toBeCloseTo(14, 9);
    expect(b.ues.find((u) => u.id === ue2.id)!.validee).toBe(false);
  });

  it("entrée en L3 refusée tant que la L1 n'est pas entièrement validée", async () => {
    const { e } = await etablissement();
    const N = await import("@/data/niveauStore");
    const { checkReinscriptionEligibility } = await import("@/data/reinscriptionEligibility");
    const classeDe = (alias: string) => e.St.getClasses().find((c) => c.filiereId === e.classe.filiereId && c.niveau === alias)!;
    const niveauDe = (alias: string) => N.getNiveaux().find((n) => n.filiereId === e.classe.filiereId && n.alias === alias)!;
    const awa = e.inscrire("Awa", "SECK");
    e.S.registerInscriptionCorrection({ etudiantId: awa.id, annee: "2023-2024", filiereId: e.classe.filiereId, classeId: classeDe("L1").id, niveau: "L1", statut: "inscrit", soldeDu: 0 }, "Parcours de test");
    e.S.registerReinscription({ etudiantId: awa.id, annee: "2024-2025", filiereId: e.classe.filiereId, classeId: classeDe("L2").id, niveau: "L2", statut: "inscrit", soldeDu: 0 });
    const versL3 = checkReinscriptionEligibility(awa.id, niveauDe("L3"));
    expect(versL3.decision).toBe("blocked");
    expect(versL3.reasons.join(" ")).toMatch(/L1 n'est pas entièrement validé/);
  });
});

describe("pas d'arrondi", () => {
  it("9,996 s'affiche 9,99 (jamais 10,00) et une moyenne de 10 exactement est bien acquise", async () => {
    const { formatNote, atteint, tronquer } = await import("@/lib/notes");
    expect(formatNote(9.996)).toBe("9,99");
    expect(formatNote(12.6)).toBe("12,60");
    expect(tronquer(14 * 0.3 + 12 * 0.7)).toBe(12.6);
    expect(atteint(0.1 * 3 * (10 / 0.3), 10)).toBe(true);
    expect(atteint(9.999, 10)).toBe(false);
  });
});
