import { describe, expect, it } from "vitest";
import { preparerEtablissement } from "../fixtures/etablissement";

async function moteur() {
  const F = await import("@/lib/formules");
  const calc = (texte: string, ctx: Record<string, unknown> = {}, vars = Object.keys(ctx)) =>
    F.calculerFormule(F.compilerFormule(texte, vars.map(F.normaliserNom)), Object.fromEntries(Object.entries(ctx).map(([k, v]) => [F.normaliserNom(k), v])) as never);
  const erreur = (texte: string, vars: string[] = []) => {
    try { F.compilerFormule(texte, vars); return ""; } catch (e) { return (e as Error).message; }
  };
  return { F, calc, erreur };
}

describe("moteur de formules — écriture « Excel en français »", () => {
  it("calcule une note : virgule décimale, × et ÷, = facultatif, pourcentages", async () => {
    const { calc } = await moteur();
    expect(calc("=DEVOIR*0,3+EXAMEN*0,7", { DEVOIR: 14, EXAMEN: 12 })).toBeCloseTo(12.6, 9);
    expect(calc("DEVOIR × 30% + EXAMEN × 70%", { DEVOIR: 14, EXAMEN: 12 })).toBeCloseTo(12.6, 9);
    expect(calc("(12 + 8) ÷ 2")).toBe(10);
    expect(calc("devoir*0.4 + examen*0.6", { DEVOIR: 14, EXAMEN: 12 })).toBeCloseTo(12.8, 9);
  });

  it("SI imbriqués, textes et comparaisons (formules du gérant)", async () => {
    const { calc } = await moteur();
    expect(calc('=SI(MOYENNE_UE>=10;"UE ACQUISE";"UE NON ACQUISE")', { MOYENNE_UE: 9.95 })).toBe("UE NON ACQUISE");
    expect(calc("=SI(MOYENNE_UE>=10;CREDITS_UE;0)", { MOYENNE_UE: 10, CREDITS_UE: 10 })).toBe(10);
    const passage = '=SI(CREDITS_ANNEE >= 60 ; "ADMIS" ; SI(CREDITS_ANNEE >= 42 ; "ADMIS AVEC DETTE" ; "REDOUBLE"))';
    expect(calc(passage, { CREDITS_ANNEE: 60 })).toBe("ADMIS");
    expect(calc(passage, { CREDITS_ANNEE: 42 })).toBe("ADMIS AVEC DETTE");
    expect(calc(passage, { CREDITS_ANNEE: 41 })).toBe("REDOUBLE");
    expect(calc('SI(ET(A >= 10 ; B >= 7) ; VRAI ; FAUX)', { A: 11, B: 6 })).toBe(false);
  });

  it("comparaisons aux limites : 10 atteint 10, 9,99 non", async () => {
    const { calc } = await moteur();
    expect(calc("A <= 10", { A: 10 })).toBe(true);
    expect(calc("A >= 10", { A: 10 })).toBe(true);
    expect(calc("A >= 10", { A: 9.99 })).toBe(false);
    expect(calc("A < 10", { A: 10 })).toBe(false);
    expect(calc("A > 10", { A: 10 })).toBe(false);
    expect(calc("A = 10", { A: 0.1 * 3 * (10 / 0.3) })).toBe(true);
    expect(calc("A <> 10", { A: 9 })).toBe(true);
    expect(calc('"VALIDÉ" = "valide"')).toBe(true);
  });

  it("listes : MOYENNE, MOYENNE_PONDEREE, MIN, MAX, NB", async () => {
    const { calc } = await moteur();
    const ctx = { MATIERES: [12.6, 7.3], CREDITS_MATIERES: [6, 4] };
    expect(calc("MOYENNE(MATIERES)", ctx)).toBeCloseTo(9.95, 9);
    expect(calc("MOYENNE_PONDEREE(MATIERES ; CREDITS_MATIERES)", ctx)).toBeCloseTo(10.48, 9);
    expect(calc("MIN(MATIERES)", ctx)).toBe(7.3);
    expect(calc("NB(MATIERES)", ctx)).toBe(2);
  });

  it("une note pas encore saisie laisse le résultat en attente (jamais 0)", async () => {
    const { calc } = await moteur();
    expect(calc("DEVOIR*0,3+EXAMEN*0,7", { DEVOIR: 14, EXAMEN: undefined })).toBeUndefined();
    // MAX ignore une valeur vide : sans rattrapage, on garde l'examen.
    expect(calc("MAX(EXAMEN ; RATTRAPAGE)", { EXAMEN: 6, RATTRAPAGE: undefined })).toBe(6);
    expect(calc("MAX(EXAMEN ; RATTRAPAGE)", { EXAMEN: 6, RATTRAPAGE: 13 })).toBe(13);
    expect(calc("SIVIDE(RATTRAPAGE ; EXAMEN)", { EXAMEN: 6, RATTRAPAGE: undefined })).toBe(6);
    expect(calc("ESTVIDE(RATTRAPAGE)", { RATTRAPAGE: undefined })).toBe(true);
  });

  it("messages d'erreur clairs, avec suggestion", async () => {
    const { erreur } = await moteur();
    expect(erreur("SI(A>=10;1;0", ["A"])).toMatch(/Parenthèse fermante/);
    expect(erreur("MAX(EXAMEN ; RATAPAGE)", ["EXAMEN", "RATTRAPAGE"])).toMatch(/« RATAPAGE » est inconnu.*RATTRAPAGE/);
    expect(erreur("MOYEN(A)", ["A"])).toMatch(/n'existe pas.*MOYENNE/);
    expect(erreur("SI(A>=10,1,0)", ["A"])).toMatch(/point-virgule/);
    expect(erreur("SI(A)", ["A"])).toMatch(/SI attend 2 à 3/);
    expect(erreur("A B", ["A", "B"])).toMatch(/opérateur/);
    expect(erreur("", [])).toMatch(/vide/);
    expect(erreur("(A + 1))", ["A"])).toMatch(/en trop/);
  });

  it("refuse de calculer avec du texte là où il faut un nombre", async () => {
    const { calc } = await moteur();
    expect(() => calc('A + "dix"', { A: 1 })).toThrow(/n'est pas un nombre/);
    expect(() => calc("MATIERES + 1", { MATIERES: [1, 2] })).toThrow(/liste/);
  });
});

describe("formules de calcul d'une filière", () => {
  it("validation : une formule de note qui renvoie du texte ou une décision inconnue est refusée", async () => {
    const { validerFormule } = await import("@/data/formulesCalcul");
    expect(validerFormule("noteEc", "DEVOIR*0,3+EXAMEN*0,7")).toBeNull();
    expect(validerFormule("noteEc", '"bien"')).toMatch(/nombre/);
    expect(validerFormule("decisionSemestre", '=SI(CREDITS_SEMESTRE>=30;"semestre... validé";"semestre... non validé")')).toBeNull();
    expect(validerFormule("decisionSemestre", 'SI(CREDITS_SEMESTRE>=30;"OK";"PEUT-ÊTRE")')).toMatch(/décision reconnue/);
    expect(validerFormule("decisionAnnee", '=SI(CREDITS_ANNEE>=60;"Licence... validée";"Licence... non validée")')).toBeNull();
  });

  it("les formules équivalentes aux réglages UCAO donnent exactement les mêmes bulletins", async () => {
    const e = await preparerEtablissement();
    const { computeBulletin } = await import("@/data/bulletinEngine");
    const Sc = await import("@/data/scolariteConfigStore");
    const { formuleEquivalente } = await import("@/data/formulesEquivalentes");
    const { ETAPES_FORMULES } = await import("@/data/formulesCalcul");
    const awa = e.inscrire("Awa", "SECK");
    let n = 0;
    for (const ue of e.uesDu("S5")) for (const ec of e.ecsDe(ue.id)) { const note = 6 + (n++ % 9); e.noter(awa.id, ec.id, "devoir", note + 1, 30); e.noter(awa.id, ec.id, "examen", note, 70); }
    const avant = computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5");
    const config = Sc.getConfigForFiliere(e.classe.filiereId)!;
    const formules = Object.fromEntries(ETAPES_FORMULES.map((x) => [x.cle, formuleEquivalente(x.cle, e.classe.filiereId)!]));
    expect(Sc.updateFormulesCalcul(config.id, formules, "Test").ok).toBe(true);
    const apres = computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5");
    expect(apres.moyenneSession).toBeCloseTo(avant.moyenneSession!, 9);
    expect(apres.creditsObtenus).toBe(avant.creditsObtenus);
    apres.ues.forEach((u, i) => { expect(u.moyenne).toBeCloseTo(avant.ues[i].moyenne!, 9); expect(u.validee).toBe(avant.ues[i].validee); });
  });

  it("une formule propre à la filière change vraiment les résultats", async () => {
    const e = await preparerEtablissement();
    const { computeBulletin } = await import("@/data/bulletinEngine");
    const Sc = await import("@/data/scolariteConfigStore");
    const awa = e.inscrire("Awa", "SECK");
    const ue = e.uesDu("S5")[0];
    const [ec1, ec2] = e.ecsDe(ue.id);
    e.noter(awa.id, ec1.id, "devoir", 14, 30); e.noter(awa.id, ec1.id, "examen", 12, 70);
    e.noter(awa.id, ec2.id, "devoir", 8, 30); e.noter(awa.id, ec2.id, "examen", 7, 70);
    const config = Sc.getConfigForFiliere(e.classe.filiereId)!;
    // Master : 40 % / 60 % ; UE acquise dès 9,5 si aucune matière sous 7.
    expect(Sc.updateFormulesCalcul(config.id, {
      noteEc: "DEVOIR × 0,4 + EXAMEN_RETENU × 0,6",
      creditsUe: "SI(ET(MOYENNE_UE >= 9,5 ; NOTE_MIN >= 7) ; CREDITS_UE ; 0)",
    }, "Test").ok).toBe(true);
    const b = computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5");
    const u = b.ues.find((x) => x.id === ue.id)!;
    expect(u.ecs.find((l) => l.id === ec1.id)!.moyenne).toBeCloseTo(12.8, 9);
    expect(u.ecs.find((l) => l.id === ec2.id)!.moyenne).toBeCloseTo(7.4, 9);
    expect(u.moyenne).toBeCloseTo(10.1, 9);
    expect(u.validee).toBe(true);
    // Une formule incorrecte n'est jamais enregistrée.
    const refus = Sc.updateFormulesCalcul(config.id, { noteEc: "DEVOIR × 0,4 + EXAMN × 0,6" }, "Test");
    expect(refus.ok).toBe(false);
    expect(refus.reason).toMatch(/EXAMN.*EXAMEN/);
    // Effacer la formule rend l'étape aux réglages.
    expect(Sc.updateFormulesCalcul(config.id, {}, "Test").ok).toBe(true);
    expect(computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", "S5").ues.find((x) => x.id === ue.id)!.validee).toBe(false);
  });

  it("décisions du jury écrites en formule : semestre et année", async () => {
    const e = await preparerEtablissement();
    const Sc = await import("@/data/scolariteConfigStore");
    const Rv = await import("@/data/reglesValidationStore");
    const D = await import("@/data/deliberationStore");
    const DA = await import("@/data/deliberationAnnuelleStore");
    const awa = e.inscrire("Awa", "SECK");
    const [premiere, ...autres] = e.uesDu("S5");
    e.ecsDe(premiere.id).forEach((ec) => { e.noter(awa.id, ec.id, "devoir", 8, 30); e.noter(awa.id, ec.id, "examen", 8, 70); });
    autres.forEach((u) => e.ecsDe(u.id).forEach((ec) => { e.noter(awa.id, ec.id, "devoir", 15, 30); e.noter(awa.id, ec.id, "examen", 15, 70); }));
    const config = Sc.getConfigForFiliere(e.classe.filiereId)!;
    // Semestre validé avec 20 crédits et une moyenne d'au moins 12 (règle d'exemple).
    expect(Sc.updateFormulesCalcul(config.id, {
      decisionSemestre: 'SI(ET(CREDITS_SEMESTRE >= 20 ; MOYENNE_SEMESTRE >= 12) ; "VALIDÉ" ; "NON VALIDÉ")',
      decisionAnnee: 'SI(CREDITS_ANNEE >= 20 ; "ADMIS AVEC DETTE" ; "REDOUBLE")',
    }, "Test").ok).toBe(true);
    const sem = e.semestreDe("S5");
    const etudiants = [{ id: awa.id, prenom: "Awa", nom: "SECK", matricule: awa.matricule }];
    const d = D.chargerDeliberation({ filiereId: e.classe.filiereId, filiere: e.classe.filiere, annee: "2025-2026", niveauAlias: "L3", niveauLabel: "Licence 3", classeId: e.classe.id, classe: e.classe.nom, semestreId: sem.id, semestreAlias: "S5", semestreLabel: "Semestre 5 (S5)", etudiants, regle: Rv.getRegleValidation(e.classe.filiereId, "semestre")!, effectuePar: "Test" });
    expect(d.lignes[0].creditsObtenus).toBe(20);
    expect(d.lignes[0].decisionAuto).toBe("admis");
    const da = DA.chargerDeliberationAnnuelle({ filiereId: e.classe.filiereId, filiere: e.classe.filiere, annee: "2025-2026", niveauId: e.niveau.id, niveauAlias: "L3", niveauLabel: "Licence 3", niveau: e.niveau, classeId: e.classe.id, classe: e.classe.nom, semestresAlias: ["S5", "S6"], etudiants, regle: Rv.getRegleValidation(e.classe.filiereId, "annee")!, effectuePar: "Test" });
    expect(da.lignes[0].decisionAuto).toBe("admis_avec_dette");
  });
});
