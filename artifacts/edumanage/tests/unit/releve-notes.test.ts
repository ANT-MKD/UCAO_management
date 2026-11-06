import { afterEach, describe, expect, it } from "vitest";
import { ANNEE_TEST, preparerEtablissement } from "../fixtures/etablissement";
import { buildPrintHtml, numeroSemestre, type BulletinResolu } from "@/pages/admin/RelevesPage";
import { remplacerEtablissement, type EtablissementInfo } from "@/data/etablissementStore";
import type { ReleveRecord } from "@/data/studentStore";

/** Relevé de notes disposé comme le relevé officiel de l'ISAE (données fictives). */

const ETAB: EtablissementInfo = {
  nom: "Institut de test", adresse: "Thiès", telephone: "", email: "", siteWeb: "", agrement: "",
  ville: "Thiès", enteteForme: "standard", enteteLignes: [], enteteCadre: true, piedLignes: [],
};
afterEach(() => remplacerEtablissement([{ id: "1", ...ETAB }]));

const releve = {
  id: "rel-1", etudiantId: "et-awa", etudiant: "Awa SECK", matricule: "2026-LPIG-0001", classe: "IG3-25/26", semestre: "Semestre 6 (S6)", annee: "2025-2026",
} as unknown as ReleveRecord;
const ue = (code: string, libelle: string, moyenne: number, credits: number, ecs: { libelle: string; moyenne: number }[], validee = true) => ({
  id: code, code, libelle, credits, moyenne, creditsObtenus: validee ? credits : 0, validee, ecs: ecs.map((e) => ({ id: e.libelle, ...e })),
});
const resolu = (modif: Partial<BulletinResolu> = {}) => ({
  etudiant: { prenom: "Awa", nom: "SECK", annee: "2025-2026", dateNaissance: "2003-05-23", lieuNaissance: "Dakar" },
  ues: [
    ue("LPIG363", "Bases de données 2", 15.65, 6, [{ libelle: "MySQL", moyenne: 16.7 }, { libelle: "PL/SQL Oracle", moyenne: 14.6 }]),
    ue("LPIG362", "Réseaux", 8.5, 6, [{ libelle: "Linux", moyenne: 8.5 }], false),
  ],
  moyenne: 13.58, moyennePassage: 10, mention: "Assez bien", creditsObtenus: 24, creditsTotal: 30, totalClasse: 20, semestreAlias: "S6",
  decision: "admis", decisionLabel: "Admis", appreciation: "Semestre validé", filiereNomComplet: "Informatique de gestion", niveauLabel: "Licence 3",
  naturesUe: { LPIG363: "Obligatoire", LPIG362: "Optionnelle" },
  recapitulatif: { cumulCredits: 174, moyenneAnnuelle: 13.92, moyenneProgramme: 13.27 },
  ...modif,
}) as unknown as BulletinResolu;

describe("relevé de notes au modèle de l'ISAE", () => {
  it("numéro de semestre tiré de l'alias", () => {
    expect(numeroSemestre("S6")).toBe(6);
    expect(numeroSemestre(" s1 ")).toBe(1);
    expect(numeroSemestre("Semestre 6")).toBeUndefined();
    expect(numeroSemestre(undefined)).toBeUndefined();
  });

  it("titre, identité et spécialité comme sur le modèle", () => {
    const html = buildPrintHtml(releve, resolu());
    expect(html).toContain("RELEVÉ DE NOTES Semestre 6");
    expect(html).toContain("2026-LPIG-0001 - AWA SECK");
    expect(html).toContain("23/05/2003 à DAKAR");
    expect(html).toContain("INFORMATIQUE DE GESTION en Licence 3 pour l'année académique 2025-2026");
    expect(html).toContain("PAS DE SPÉCIALITÉ");
    expect(html).toContain(">IG3-25/26<");
    expect(buildPrintHtml(releve, resolu({ specialite: "Génie logiciel" }))).toContain("GÉNIE LOGICIEL");
    // Alias inconnu : le libellé du relevé est repris tel quel.
    expect(buildPrintHtml(releve, resolu({ semestreAlias: "X" }))).toContain("RELEVÉ DE NOTES Semestre 6 (S6)");
  });

  it("UE avec leur nature et leur résultat, matières en dessous, moyenne du semestre sans mention", () => {
    const html = buildPrintHtml(releve, resolu());
    expect(html).toMatch(/<tr class="ue">\s*<td class="mat">LPIG363 - Bases de données 2 \(Obligatoire\)<\/td>[\s\S]*?<td class="res">UE Acquise<\/td>/);
    expect(html).toMatch(/<tr class="ue">\s*<td class="mat">LPIG362 - Réseaux \(Optionnelle\)<\/td>[\s\S]*?<td class="res">UE Non Acquise<\/td>/);
    expect(html).toMatch(/<tr class="ec">\s*<td class="mat">MySQL<\/td>\s*<td class="esp"><\/td>\s*<td class="c b">16,70<\/td>/);
    expect(html).toMatch(/Moyenne Semestre 6<\/td>\s*<td class="esp"><\/td>\s*<td class="c">13,58<\/td>\s*<td class="c">24\/30<\/td>/);
    expect(html).not.toContain("Mention");
    expect(html).toContain(`<td class="appreciation">Semestre validé</td>`);
  });

  it("bas du relevé : crédits cumulés, moyennes annuelle et programme seulement quand elles sont fournies", () => {
    const complet = buildPrintHtml(releve, resolu());
    expect(complet).toContain("<tr><td>Cumul Crédits</td><td>174</td></tr>");
    expect(complet).toContain("<tr><td>Moyenne Annuelle</td><td>13,92</td></tr>");
    expect(complet).toContain("<tr><td>Moyenne Programme</td><td>13,27</td></tr>");
    const debutAnnee = buildPrintHtml(releve, resolu({ recapitulatif: { cumulCredits: 144 } }));
    expect(debutAnnee).toContain("<tr><td>Cumul Crédits</td><td>144</td></tr>");
    expect(debutAnnee).not.toContain("Moyenne Annuelle");
    expect(debutAnnee).not.toContain("Moyenne Programme");
  });

  it("cadre du Directeur vide pour le cachet, « Fait à », pied de page ; plus de faux cachet ni de numéro", () => {
    remplacerEtablissement([{ id: "1", ...ETAB, piedLignes: ["Route de Mont-Rolland", "Tél : 33 000 00 00"] }]);
    const html = buildPrintHtml(releve, resolu());
    expect(html).toContain(`<th class="qualite" colspan="4">Le Directeur</th>`);
    expect(html).toMatch(/<td class="directeur" colspan="4"><\/td>/);
    expect(html).toContain(`Fait à Thiès, le ${new Date().toLocaleDateString("fr-FR")}`);
    expect(html).toContain(`<div class="pied"><div>Route de Mont-Rolland</div><div>Tél : 33 000 00 00</div></div>`);
    expect(html).not.toContain("seal");
    expect(html).not.toContain("N° REL");
  });

  it("tout est échappé", () => {
    const html = buildPrintHtml({ ...releve, classe: "<i>IG3</i>" } as ReleveRecord,
      resolu({ etudiant: { prenom: "<b>Awa</b>", nom: "SECK", annee: "2025-2026" } as BulletinResolu["etudiant"], specialite: "<script>" }));
    expect(html).not.toMatch(/<b>AWA|<i>IG3|<script>/i);
    expect(html).toContain("&lt;B&gt;AWA&lt;/B&gt; SECK");
  });
});

describe("relevé calculé : crédits cumulés et moyennes de fin d'année", () => {
  it("S5 : cumul du semestre seul ; S6 : cumul de l'année, moyennes annuelle et programme", async () => {
    const e = await preparerEtablissement();
    const awa = e.inscrire("Awa", "SECK");
    const noterTout = (semestre: string, note: number) => {
      for (const u of e.uesDu(semestre)) for (const ec of e.ecsDe(u.id)) e.noter(awa.id, ec.id, "examen", note, 100);
    };
    noterTout("S5", 12);
    noterTout("S6", 14);
    const { resolveBulletin } = await import("@/pages/admin/RelevesPage");
    const { computeBulletin, computeMoyenneAnnuelle } = await import("@/data/bulletinEngine");
    const releveDe = (alias: string) => e.S.getReleves().find((r) => r.etudiantId === awa.id && r.semestre.includes(`(${alias})`))!;
    const s5 = resolveBulletin(releveDe("S5"), e.S.getEtudiants())!;
    const s6 = resolveBulletin(releveDe("S6"), e.S.getEtudiants())!;
    const credits = (alias: string) => computeBulletin(awa.id, e.classe.id, e.classe.filiereId, "L3", alias).creditsObtenus;

    expect(credits("S5")).toBeGreaterThan(0);
    expect(s5.recapitulatif).toEqual({ cumulCredits: credits("S5") });
    expect(s6.recapitulatif?.cumulCredits).toBe(credits("S5") + credits("S6"));
    const annuelle = computeMoyenneAnnuelle(awa.id, e.classe.id, e.classe.filiereId, "L3").moyenne!;
    expect(annuelle).toBeGreaterThan(12);
    expect(annuelle).toBeLessThan(14);
    expect(s6.recapitulatif?.moyenneAnnuelle).toBeCloseTo(annuelle, 9);
    // Awa n'a que la L3 dans son parcours : la moyenne programme est celle de cette année.
    expect(s6.recapitulatif?.moyenneProgramme).toBeCloseTo(annuelle, 9);
    // Nature de chaque UE, et pas de spécialité à son inscription.
    expect(Object.keys(s6.naturesUe ?? {}).sort()).toEqual(s6.ues.map((u) => u.id).sort());
    expect(s6.specialite).toBeUndefined();
    const inscription = e.S.getInscriptionsByEtudiant(awa.id).find((i) => i.annee === ANNEE_TEST)!;
    inscription.specialite = "Génie logiciel";
    expect(resolveBulletin(releveDe("S6"), e.S.getEtudiants())!.specialite).toBe("Génie logiciel");
  });
});
