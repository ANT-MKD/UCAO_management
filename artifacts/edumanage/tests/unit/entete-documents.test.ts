import { afterEach, describe, expect, it } from "vitest";
import {
  enteteScolaireActif, enteteScolaireHtml, erreursReglagesDocuments, LIGNES_ENTETE_EXEMPLE, phraseSoussigne, piedScolaireHtml, signataireDe,
} from "@/lib/enteteDocuments";
import { getEtablissement, remplacerEtablissement, villeEtablissement, type EtablissementInfo } from "@/data/etablissementStore";
import { remplacerSignaturesDocuments, type SignatureConfig } from "@/data/signatureConfigStore";
import { buildAttestationHtml } from "@/pages/admin/AttestationsPage";
import { buildPrintHtml, type BulletinResolu } from "@/pages/admin/RelevesPage";
import { enteteDocumentScolaireHtml } from "@/lib/printDocument";
import type { AttestationRecord } from "@/data/attestationStore";
import type { ReleveRecord } from "@/data/studentStore";

const BANNIERE = "data:image/png;base64,QkFOTklFUkU=";
const LOGO_UCAO = "data:image/png;base64,VUNBTw==";
const LOGO_ISAE = "data:image/png;base64,SVNBRQ==";

const ETAB: EtablissementInfo = {
  nom: "Université Catholique de l'Afrique de l'Ouest", adresse: "Route de Mont-Rolland, Thiès", telephone: "", email: "", siteWeb: "", agrement: "",
  ville: "", enteteForme: "standard", enteteLignes: [], enteteCadre: true, piedLignes: [],
};
const PIED = ["Route de Mont-Rolland", "Tél. : (00221) 33 951 14 81", "isaet@ucao.edu.sn"];
const SIGNATAIRE: SignatureConfig = { actif: true, signataireNom: "M. Laurent Dominique SAGNA", signataireQualite: "Responsable de la scolarité à l'ISAE Thiès" };

const installer = (etab: Partial<EtablissementInfo>, signature?: SignatureConfig) => {
  remplacerEtablissement([{ id: "1", ...ETAB, ...etab }]);
  const sans: SignatureConfig = { actif: false, signataireNom: "", signataireQualite: "Le Directeur" };
  remplacerSignaturesDocuments((["bulletin", "inscription", "reussite", "scolarite"] as const).map((id) => ({ id, ...(signature ?? sans) })));
};
afterEach(() => installer({}));

describe("en-tête des documents scolaires", () => {
  it("sans réglage, chaque document garde son en-tête d'origine", () => {
    expect(enteteScolaireActif(ETAB)).toBe(false);
    expect(enteteScolaireHtml(ETAB)).toBeNull();
    expect(piedScolaireHtml(ETAB)).toBeNull();
    // Forme choisie mais incomplète : rien ne change non plus.
    expect(enteteScolaireHtml({ ...ETAB, enteteForme: "banniere" })).toBeNull();
    expect(enteteScolaireHtml({ ...ETAB, enteteForme: "compose" })).toBeNull();
  });

  it("bannière : l'image occupe toute la largeur, sans retouche", () => {
    const html = enteteScolaireHtml({ ...ETAB, enteteForme: "banniere", banniereDataUrl: BANNIERE })!;
    expect(html).toContain(`src="${BANNIERE}"`);
    expect(html).toContain("width:100%");
  });

  it("en-tête composé : les deux logos encadrent les lignes, chacune avec sa taille, son style et sa couleur", () => {
    const html = enteteScolaireHtml({ ...ETAB, enteteForme: "compose", logoDataUrl: LOGO_UCAO, logoDroitDataUrl: LOGO_ISAE, enteteLignes: LIGNES_ENTETE_EXEMPLE })!;
    expect(html.indexOf(LOGO_UCAO)).toBeLessThan(html.indexOf("Faculté des Sciences de Gestion"));
    expect(html.indexOf("Faculté des Sciences de Gestion")).toBeLessThan(html.indexOf(LOGO_ISAE));
    expect(html).toContain("font-size:17px;font-weight:700;font-style:normal;color:#8b1a1a");
    expect(html).toContain("font-size:11.5px;font-weight:400;font-style:italic;color:#8b1a1a");
    expect(html).toContain("color:#1f3a7a");
    expect(html).toContain("Université Catholique de l&#39;Afrique de l&#39;Ouest (UCAO)");
    expect(html).toContain("border:1.5px solid");
    expect(enteteScolaireHtml({ ...ETAB, enteteForme: "compose", enteteCadre: false, enteteLignes: LIGNES_ENTETE_EXEMPLE })).not.toContain("border:");
  });

  it("un texte saisi ne peut pas glisser de balise dans le document", () => {
    const html = enteteScolaireHtml({ ...ETAB, enteteForme: "compose", enteteLignes: [{ texte: "<script>alert(1)</script>", taille: "grande", style: "gras", couleur: "noir" }] })!;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(piedScolaireHtml({ ...ETAB, piedLignes: ['<img src="x">'] })).toContain("&lt;img src=&quot;x&quot;&gt;");
  });

  it("pied de page : ses lignes, dans l'ordre, sans les lignes vides", () => {
    const html = piedScolaireHtml({ ...ETAB, piedLignes: [PIED[0], "  ", PIED[1], PIED[2]] })!;
    expect(html.indexOf(PIED[0])).toBeLessThan(html.indexOf(PIED[1]));
    expect(html).toContain(PIED[2]);
    expect(html.match(/<div>/g)).toHaveLength(3);
  });

  it("la ville de « Fait à » : celle réglée, sinon le début de l'adresse", () => {
    expect(villeEtablissement(ETAB)).toBe("Route de Mont-Rolland");
    expect(villeEtablissement({ ...ETAB, ville: "Thiès" })).toBe("Thiès");
  });

  it("les réglages sont contrôlés comme dans la base", () => {
    expect(erreursReglagesDocuments({ ...ETAB, enteteForme: "compose", enteteLignes: LIGNES_ENTETE_EXEMPLE, piedLignes: PIED, ville: "Thiès" })).toEqual([]);
    expect(erreursReglagesDocuments({ ...ETAB, enteteForme: "banniere" })[0]).toContain("bannière");
    const sept = Array.from({ length: 7 }, () => ({ ...LIGNES_ENTETE_EXEMPLE[0] }));
    expect(erreursReglagesDocuments({ ...ETAB, enteteLignes: sept }).join()).toContain("6 lignes");
    expect(erreursReglagesDocuments({ ...ETAB, enteteLignes: [{ ...LIGNES_ENTETE_EXEMPLE[0], texte: "x".repeat(121) }] }).join()).toContain("120 caractères");
    expect(erreursReglagesDocuments({ ...ETAB, piedLignes: ["a", "b", "c", "d"] }).join()).toContain("3 lignes");
    expect(erreursReglagesDocuments({ ...ETAB, piedLignes: ["x".repeat(161)] }).join()).toContain("160 caractères");
    expect(erreursReglagesDocuments({ ...ETAB, ville: "x".repeat(61) }).join()).toContain("60 caractères");
  });
});

describe("signataire", () => {
  it("le nom et la qualité ouvrent le texte ; sans signataire activé, la phrase d'origine", () => {
    expect(phraseSoussigne(SIGNATAIRE, ETAB.nom)).toBe(
      "Je soussigné(e), <strong>M. Laurent Dominique SAGNA</strong>, Responsable de la scolarité à l&#39;ISAE Thiès, certifie par la présente que :");
    expect(phraseSoussigne({ ...SIGNATAIRE, signataireQualite: " " }, ETAB.nom)).toBe(
      "Je soussigné(e), <strong>M. Laurent Dominique SAGNA</strong>, certifie par la présente que :");
    expect(phraseSoussigne({ ...SIGNATAIRE, actif: false }, ETAB.nom)).toContain("le Directeur de Université Catholique");
    expect(signataireDe({ ...SIGNATAIRE, signataireNom: "  " })).toBeNull();
  });
});

const ATTESTATION: AttestationRecord = {
  id: "att-1", numero: "ATT-2026-007", etudiantId: "et-awa", etudiant: "Awa SECK", matricule: "2026-LPIG-0001",
  classeId: "cl-ig3", classe: "IG3-25/26", filiereId: "fil-lpig", filiere: "Licence professionnelle en informatique de gestion", annee: "2025-2026",
  type: "inscription", typeLabel: "Attestation d'inscription", soldeDuConstate: 0, statut: "genere", dateGeneration: "2026-01-07", effectuePar: "Secrétariat",
};

describe("attestations", () => {
  it("sans en-tête réglé : la présentation d'origine, avec le signataire nommé", () => {
    installer({}, SIGNATAIRE);
    const html = buildAttestationHtml(ATTESTATION);
    expect(html).toContain("Concerne");
    expect(html).toContain("<strong>M. Laurent Dominique SAGNA</strong>, Responsable de la scolarité");
    expect(html).toContain("Responsable de la scolarité à l&#39;ISAE Thiès<br />M. Laurent Dominique SAGNA");
  });

  it("avec la bannière : en-tête, titre, matricule, « Fait à Thiès », signataire et pied de page", () => {
    installer({ enteteForme: "banniere", banniereDataUrl: BANNIERE, piedLignes: PIED, ville: "Thiès" }, SIGNATAIRE);
    const html = buildAttestationHtml(ATTESTATION);
    expect(html).toContain(`src="${BANNIERE}"`);
    expect(html).toContain(`<div class="titre">ATTESTATION D&#39;INSCRIPTION</div>`);
    expect(html).toContain("Réf. ATT-2026-007");
    expect(html).toContain("Matricule : <strong>2026-LPIG-0001</strong>");
    expect(html).toContain("Je soussigné(e), <strong>M. Laurent Dominique SAGNA</strong>");
    expect(html).toContain("Fait à Thiès, le 7 janvier 2026");
    expect(html).toContain(`<div class="nom">M. Laurent Dominique SAGNA</div>`);
    for (const ligne of PIED) expect(html).toContain(ligne);
    expect(html).not.toContain("Concerne");
    expect(html.indexOf(BANNIERE)).toBeLessThan(html.indexOf("Je soussigné"));
    expect(html.indexOf("Je soussigné")).toBeLessThan(html.indexOf(PIED[0]));
  });

  it("le nom de l'étudiant est échappé", () => {
    installer({ enteteForme: "banniere", banniereDataUrl: BANNIERE });
    expect(buildAttestationHtml({ ...ATTESTATION, etudiant: "<b>Awa</b> SECK" })).toContain("&lt;b&gt;Awa&lt;/b&gt; SECK");
  });
});

describe("relevés de notes et procès-verbaux", () => {
  const releve = { id: "rel-1", etudiantId: "et-awa", etudiant: "Awa SECK", matricule: "2026-LPIG-0001", classe: "IG3-25/26", semestre: "Semestre 1", annee: "2025-2026" } as unknown as ReleveRecord;
  const resolu = {
    etudiant: { annee: "2025-2026", dateNaissance: "2003-05-23", lieuNaissance: "Dakar" }, ues: [], moyenne: 13.58, moyennePassage: 10, mention: "Assez bien",
    creditsObtenus: 30, creditsTotal: 30, totalClasse: 20, semestreAlias: "S1", decision: "admis", decisionLabel: "Admis", appreciation: "Semestre validé",
    filiereNomComplet: "Informatique de gestion", niveauLabel: "Licence 3",
  } as unknown as BulletinResolu;

  it("sans en-tête réglé : un cadre au nom de l'établissement, sans faux cachet", () => {
    const html = buildPrintHtml(releve, resolu);
    expect(html).toContain(`<div class="cadre-defaut">`);
    expect(html).toContain("Université Catholique de l&#39;Afrique de l&#39;Ouest");
    expect(html).not.toContain("seal");
    expect(html).toContain(`<th class="qualite" colspan="4">Le Directeur</th>`);
  });

  it("avec l'en-tête composé : les vrais logos remplacent les sceaux, la qualité du signataire titre la colonne", () => {
    installer({ enteteForme: "compose", logoDataUrl: LOGO_UCAO, logoDroitDataUrl: LOGO_ISAE, enteteLignes: LIGNES_ENTETE_EXEMPLE, piedLignes: PIED, ville: "Thiès" },
      { ...SIGNATAIRE, signataireQualite: "Le Directeur des études" });
    const html = buildPrintHtml(releve, resolu);
    expect(html).not.toContain(`<div class="cadre-defaut">`);
    expect(html).not.toContain("seal");
    expect(html).toContain(LOGO_ISAE);
    expect(html).toContain(`<th class="qualite" colspan="4">Le Directeur des études</th>`);
    expect(html).toContain("M. Laurent Dominique SAGNA");
    expect(html).toContain("Fait à Thiès, le");
    expect(html).toContain(PIED[1]);
    expect(html).not.toContain("N° REL");
  });

  it("le procès-verbal prend l'en-tête réglé, sinon celui d'origine", () => {
    expect(enteteDocumentScolaireHtml()).toContain(getEtablissement().nom);
    installer({ enteteForme: "banniere", banniereDataUrl: BANNIERE });
    expect(enteteDocumentScolaireHtml()).toContain(`src="${BANNIERE}"`);
  });
});
