import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  champsDe, corpsModeleHtml, dateLongue, erreursModele, MODELES_PAR_DEFAUT, valeursDesChamps,
  type ModeleAttestation, type TypeModele, type ValeursAttestation,
} from "@/lib/modelesAttestations";
import { getModeleAttestation, remplacerModelesAttestations, setModeleAttestation } from "@/data/modeleAttestationStore";
import { remplacerEtablissement, type EtablissementInfo } from "@/data/etablissementStore";
import { remplacerSignaturesDocuments, type SignatureConfig } from "@/data/signatureConfigStore";
import { remplacerEtudiants, type EtudiantRecord } from "@/data/studentStore";
import { remplacerClasses, type ClassePedagogiqueRecord } from "@/data/structureStore";
import { remplacerNiveaux, type NiveauRecord } from "@/data/niveauStore";
import { buildAttestationHtml } from "@/pages/admin/AttestationsPage";
import type { AttestationRecord } from "@/data/attestationStore";

// Le fichier prend la version enregistrée sur la base en service : on le trouve par son nom.
const MIGRATIONS = resolve(__dirname, "../../../../supabase/migrations");
const MIGRATION = readFileSync(resolve(MIGRATIONS, readdirSync(MIGRATIONS).find((f) => f.endsWith("_textes_attestations.sql"))!), "utf8");

const ETAB: EtablissementInfo = {
  nom: "Université Catholique de l'Afrique de l'Ouest", adresse: "Route de Mont-Rolland, Thiès", telephone: "", email: "", siteWeb: "", agrement: "",
  ville: "Thiès", enteteForme: "standard", enteteLignes: [], enteteCadre: true, piedLignes: [],
};
const SAGNA: SignatureConfig = { actif: true, signataireNom: "M. Laurent Dominique SAGNA", signataireQualite: "Responsable de la scolarité à l'ISAE Thiès" };
const SANS_SIGNATAIRE: SignatureConfig = { actif: false, signataireNom: "", signataireQualite: "Le Directeur" };

const installer = (signature: SignatureConfig = SANS_SIGNATAIRE, etab: Partial<EtablissementInfo> = {}) => {
  remplacerEtablissement([{ id: "1", ...ETAB, ...etab }]);
  remplacerSignaturesDocuments((["bulletin", "inscription", "reussite", "scolarite"] as const).map((id) => ({ id, ...signature })));
};
afterEach(() => {
  installer();
  remplacerModelesAttestations([]);
  remplacerEtudiants([]);
});

const AWA: ValeursAttestation = {
  nom: "Awa SECK", matricule: "2026-LPIG-0001", sexe: "F", dateNaissance: "2003-05-23", lieuNaissance: "Dakar", nationalite: "Sénégalaise",
  classe: "IG3-25/26", niveau: "Licence 3", filiere: "Licence professionnelle en informatique de gestion", annee: "2025-2026",
  etablissement: "Université Catholique de l'Afrique de l'Ouest", signataire: { nom: "M. Laurent Dominique SAGNA", qualite: "Responsable de la scolarité à l'ISAE Thiès" },
};

const texte = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#39;/g, "'").replace(/&amp;/g, "&");

describe("texte d'une attestation : les champs remplis à l'impression", () => {
  it("le certificat d'inscription de départ, rempli pour Awa SECK : son nom en capitales, centré, et l'accord au féminin", () => {
    const html = corpsModeleHtml(MODELES_PAR_DEFAUT.inscription, valeursDesChamps(AWA));
    const paragraphes = html.split("\n");
    expect(paragraphes).toHaveLength(5);
    expect(paragraphes[0]).toBe(`<p style="text-align:justify">Je soussigné(e), <strong>M. Laurent Dominique SAGNA, Responsable de la scolarité à l&#39;ISAE Thiès</strong>, certifie que :</p>`);
    expect(paragraphes[1]).toBe(`<p style="text-align:center"><strong>AWA SECK</strong></p>`);
    expect(paragraphes[2]).toBe(`<p style="text-align:center">Née le <strong>23 mai 2003</strong> à <strong>Dakar</strong></p>`);
    expect(texte(paragraphes[3])).toBe("de nationalité Sénégalaise, est inscrite dans notre établissement en classe de Licence 3 de Licence professionnelle en informatique de gestion, "
      + "sous le matricule 2026-LPIG-0001, pour l'année académique 2025-2026.");
    expect(paragraphes[3]).toContain("est inscrite dans");
  });

  it("Ousmane DIALLO : « Né », « inscrit » ; sexe inconnu : « Né(e) », « inscrit(e) »", () => {
    const m: ModeleAttestation = { titre: "T", paragraphes: [{ texte: "{nom} ({matricule}) : {Ne}, {ne}, {inscrit}", centre: false }] };
    const ousmane = { ...AWA, nom: "Ousmane DIALLO", sexe: "M" as const };
    expect(texte(corpsModeleHtml(m, valeursDesChamps(ousmane)))).toBe("Ousmane DIALLO (2026-LPIG-0001) : Né, né, inscrit");
    expect(texte(corpsModeleHtml(m, valeursDesChamps({ ...ousmane, sexe: undefined })))).toBe("Ousmane DIALLO (2026-LPIG-0001) : Né(e), né(e), inscrit(e)");
  });

  it("une information absente de la fiche se voit « ……… » ; sans signataire nommé, « le Directeur de l'établissement »", () => {
    const valeurs = valeursDesChamps({ ...AWA, lieuNaissance: "  ", dateNaissance: undefined, signataire: undefined });
    const html = corpsModeleHtml(MODELES_PAR_DEFAUT.inscription, valeurs);
    expect(html).toContain("Née le <strong>………</strong> à <strong>………</strong>");
    expect(html).toContain("<strong>le Directeur de Université Catholique de l&#39;Afrique de l&#39;Ouest</strong>");
    expect(valeurs.signataire).toBe("le Directeur");
  });

  it("ce qui est écrit, comme les informations de l'étudiant, ne peut pas glisser de balise dans le document", () => {
    const m: ModeleAttestation = { titre: "T", paragraphes: [{ texte: "<script>alert(1)</script> {nom} {matricule}\nligne 2", centre: false }] };
    const html = corpsModeleHtml(m, valeursDesChamps({ ...AWA, nom: "<b>Awa</b>", matricule: "M&1" }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Awa");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; <strong>&lt;b&gt;Awa&lt;/b&gt;</strong> <strong>M&amp;1</strong><br />ligne 2");
  });

  it("dates longues en français, sans décalage de fuseau", () => {
    expect(dateLongue("2003-05-23")).toBe("23 mai 2003");
    expect(dateLongue("2004-01-01T00:00:00Z")).toBe("1 janvier 2004");
    expect(dateLongue("")).toBe("");
    expect(dateLongue("2004-13-01")).toBe("");
  });
});

describe("contrôle d'un texte : les mêmes règles que la base", () => {
  const avec = (...textes: string[]): ModeleAttestation => ({ titre: "CERTIFICAT", paragraphes: textes.map((t) => ({ texte: t, centre: false })) });

  it("les textes de départ sont valides", () => {
    for (const t of ["inscription", "scolarite", "reussite"] as TypeModele[]) expect(erreursModele(t, MODELES_PAR_DEFAUT[t])).toEqual([]);
  });

  it("le nom et le matricule sont obligatoires ; un champ inconnu ou une accolade seule sont refusés, avec un message clair", () => {
    expect(erreursModele("scolarite", avec("{nom} est inscrit."))).toEqual(["Le matricule ({matricule}) doit figurer dans le texte."]);
    expect(erreursModele("scolarite", avec("Matricule {matricule}."))).toEqual(["Le nom de l'étudiant ({NOM} ou {nom}) doit figurer dans le texte."]);
    expect(erreursModele("scolarite", avec("{nom} ({matricule}) : {telephone}"))).toEqual(["Champ inconnu : {telephone}. Utilisez les boutons pour insérer un champ."]);
    expect(erreursModele("scolarite", avec("{nom} ({matricule}) a obtenu {moyenne}/20"))).toEqual(["Le champ {moyenne} n'existe que dans l'attestation de réussite."]);
    expect(erreursModele("reussite", avec("{nom} ({matricule}) a obtenu {moyenne}/20"))).toEqual([]);
    expect(erreursModele("scolarite", avec("{nom} ({matricule}) {matricule"))).toEqual([expect.stringContaining("accolade est seule")]);
    expect(erreursModele("scolarite", avec("{nom} ({matricule}) }"))).toEqual([expect.stringContaining("accolade est seule")]);
  });

  it("titre de 1 à 80 caractères, 1 à 12 paragraphes de 600 caractères au plus", () => {
    expect(erreursModele("scolarite", { ...avec("{nom} {matricule}"), titre: "  " })).toEqual(["Donnez un titre au document."]);
    expect(erreursModele("scolarite", { ...avec("{nom} {matricule}"), titre: "X".repeat(81) })).toEqual(["Le titre tient en 80 caractères."]);
    expect(erreursModele("scolarite", { titre: "T", paragraphes: [] })).toContain("Écrivez au moins un paragraphe.");
    expect(erreursModele("scolarite", avec(...Array.from({ length: 13 }, () => "{nom} {matricule}")))).toEqual(["12 paragraphes au plus."]);
    expect(erreursModele("scolarite", avec(`{nom} {matricule} ${"x".repeat(600)}`))).toEqual(["Paragraphe 1 : 600 caractères au plus."]);
    expect(erreursModele("scolarite", avec(...Array.from({ length: 12 }, () => "{nom} {matricule}")))).toEqual([]);
  });

  it("les champs proposés sont ceux que la base accepte", () => {
    const tableau = (bloc: string) => [...bloc.matchAll(/'(\w+)'/g)].map((x) => x[1]);
    const fonction = MIGRATION.slice(MIGRATION.indexOf("create function private.champs_attestation"), MIGRATION.indexOf("create function private.modele_attestation_valide"));
    const [communs, reussite] = fonction.split("|| case");
    expect(champsDe("inscription").map((c) => c.cle)).toEqual(tableau(communs).filter((c) => c !== "reussite"));
    expect(champsDe("reussite").map((c) => c.cle)).toEqual([...tableau(communs), ...tableau(reussite).filter((c) => c !== "reussite")]);
  });

  it("les textes de départ de l'application sont ceux que la migration pose dans la base", () => {
    const lignes = [...MIGRATION.slice(MIGRATION.indexOf("insert into public.modeles_attestations")).matchAll(/\('(inscription|scolarite|reussite)', '((?:[^']|'')*)', '((?:[^']|'')*)'\)/g)];
    expect(lignes.map((l) => l[1])).toEqual(["inscription", "scolarite", "reussite"]);
    for (const [, id, titre, paragraphes] of lignes) {
      expect({ titre: titre.replace(/''/g, "'"), paragraphes: JSON.parse(paragraphes.replace(/''/g, "'")) }).toEqual(MODELES_PAR_DEFAUT[id as TypeModele]);
    }
  });
});

describe("attestations imprimées avec leur texte", () => {
  const ATTESTATION: AttestationRecord = {
    id: "att-1", numero: "ATT-2026-007", etudiantId: "et-awa", etudiant: "Awa SECK", matricule: "2026-LPIG-0001",
    classeId: "cl-ig3", classe: "IG3-25/26", filiereId: "fil-lpig", filiere: "Licence professionnelle en informatique de gestion", annee: "2025-2026",
    type: "inscription", typeLabel: "Attestation d'inscription", soldeDuConstate: 0, statut: "genere", dateGeneration: "2026-01-07", effectuePar: "Secrétariat",
  };
  const FIGE: ModeleAttestation = { titre: "CERTIFICAT D'INSCRIPTION", paragraphes: [{ texte: "Texte figé : {NOM}, matricule {matricule}, {inscrit}.", centre: false }] };

  it("une attestation émise s'imprime avec le texte figé à l'émission, même si le texte a changé depuis", () => {
    installer(SAGNA, { enteteForme: "banniere", banniereDataUrl: "data:image/png;base64,QkFOTklFUkU=" });
    setModeleAttestation("inscription", { titre: "NOUVEAU TITRE", paragraphes: [{ texte: "Nouveau : {nom} {matricule}", centre: false }] }, "u-admin");
    const html = buildAttestationHtml({ ...ATTESTATION, modele: FIGE }, { etudiant: { sexe: "F" } });
    expect(html).toContain(`<div class="titre">CERTIFICAT D&#39;INSCRIPTION</div>`);
    expect(html).toContain("Texte figé : <strong>AWA SECK</strong>, matricule <strong>2026-LPIG-0001</strong>, inscrite.");
    expect(html).not.toContain("NOUVEAU TITRE");
    expect(html).not.toContain("Nouveau :");
  });

  it("une attestation émise avant les textes réglables garde son texte d'origine", () => {
    installer(SAGNA);
    setModeleAttestation("inscription", { titre: "NOUVEAU TITRE", paragraphes: [{ texte: "Nouveau : {nom} {matricule}", centre: false }] }, "u-admin");
    const html = buildAttestationHtml(ATTESTATION);
    expect(html).toContain("ATTESTATION D&#39;INSCRIPTION");
    expect(html).toContain("Est régulièrement inscrit(e) dans notre établissement");
    expect(html).not.toContain("Nouveau :");
  });

  it("la fiche d'Awa, sa classe et son niveau remplissent le texte ; le signataire réglé pour ce document le signe", () => {
    installer(SAGNA, { enteteForme: "banniere", banniereDataUrl: "data:image/png;base64,QkFOTklFUkU=" });
    remplacerNiveaux([{ id: "niv-l3", nom: "Licence 3", alias: "L3", filiereId: "fil-lpig" } as unknown as NiveauRecord]);
    remplacerClasses([{ id: "cl-ig3", nom: "IG3-25/26", filiereId: "fil-lpig", niveauId: "niv-l3", niveau: "L3", max: 40 } as unknown as ClassePedagogiqueRecord]);
    remplacerEtudiants([{ id: "et-awa", prenom: "Awa", nom: "SECK", matricule: "2026-LPIG-0001", sexe: "F", dateNaissance: "2003-05-23", lieuNaissance: "Dakar",
      nationalite: "Sénégalaise", classeId: "cl-ig3" } as unknown as EtudiantRecord]);
    const html = buildAttestationHtml({ ...ATTESTATION, modele: MODELES_PAR_DEFAUT.inscription });
    expect(texte(html)).toContain("Je soussigné(e), M. Laurent Dominique SAGNA, Responsable de la scolarité à l'ISAE Thiès, certifie que :");
    expect(html).toContain("Née le <strong>23 mai 2003</strong> à <strong>Dakar</strong>");
    expect(texte(html)).toContain("de nationalité Sénégalaise, est inscrite dans notre établissement en classe de Licence 3 de Licence professionnelle en informatique de gestion");
    expect(html).toContain("Fait à Thiès, le 7 janvier 2026");
  });

  it("attestation de réussite : semestre, moyenne et décision constatés à l'émission", () => {
    installer(SAGNA);
    const html = buildAttestationHtml({ ...ATTESTATION, type: "reussite", typeLabel: "Attestation de réussite", semestreLabel: "Semestre 5", moyenneConstatee: 13.583,
      decisionConstatee: "admis", modele: MODELES_PAR_DEFAUT.reussite }, { etudiant: { sexe: "F" } });
    expect(texte(html)).toContain("a subi avec succès les épreuves du Semestre 5 de Licence professionnelle en informatique de gestion (IG3-25/26), année académique 2025-2026, "
      + "avec une moyenne de 13,58/20 et la décision du jury : Admis.");
  });

  it("sans en-tête réglé, le titre écrit remplace le badge d'origine", () => {
    installer();
    const html = buildAttestationHtml({ ...ATTESTATION, modele: { ...FIGE, titre: "CERTIFICAT <b>D'INSCRIPTION</b>" } });
    expect(html).toContain("CERTIFICAT &lt;b&gt;D&#39;INSCRIPTION&lt;/b&gt;");
    expect(html).toContain("Texte figé : <strong>AWA SECK</strong>");
  });

  it("l'aperçu des paramètres montre le texte en cours d'écriture, pas celui de l'attestation", () => {
    installer();
    const html = buildAttestationHtml({ ...ATTESTATION, modele: FIGE }, { modele: { titre: "BROUILLON", paragraphes: [{ texte: "Essai {nom} {matricule}", centre: true }] } });
    expect(html).toContain("BROUILLON");
    expect(html).toContain(`<p style="text-align:center">Essai <strong>Awa SECK</strong> <strong>2026-LPIG-0001</strong></p>`);
    expect(html).not.toContain("Texte figé");
  });
});

describe("textes enregistrés", () => {
  it("un texte enregistré est celui de la prochaine attestation ; la base peut en rendre une partie seulement", () => {
    setModeleAttestation("scolarite", { titre: "CERTIFICAT", paragraphes: [{ texte: "{nom} {matricule}", centre: false }] }, "u-admin");
    expect(getModeleAttestation("scolarite").titre).toBe("CERTIFICAT");
    remplacerModelesAttestations([{ id: "reussite", titre: "RÉUSSITE", paragraphes: [{ texte: "{NOM} {matricule}", centre: true }] }]);
    expect(getModeleAttestation("reussite").titre).toBe("RÉUSSITE");
    expect(getModeleAttestation("scolarite")).toEqual(MODELES_PAR_DEFAUT.scolarite);
  });
});
