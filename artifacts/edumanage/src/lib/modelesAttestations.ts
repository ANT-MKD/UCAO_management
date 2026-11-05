import { echapperHtml } from "@/lib/enteteDocuments";

/** Textes des attestations réglables par l'établissement (Paramètres généraux → Textes des
 * attestations). Un modèle = un titre et des paragraphes écrits librement, où des champs entre
 * accolades ({NOM}, {matricule}…) sont remplacés à l'impression par les informations de
 * l'étudiant : on écrit les phrases, jamais les données. Les règles sont celles que la base
 * contrôle (migration textes_attestations) ; les textes de départ sont les mêmes que les siens. */

export type TypeModele = "inscription" | "scolarite" | "reussite";

export interface ParagrapheModele {
  texte: string;
  /** Centré (le nom, la naissance), sinon justifié. */
  centre: boolean;
}

export interface ModeleAttestation {
  titre: string;
  paragraphes: ParagrapheModele[];
}

export const TITRE_MAX = 80;
export const PARAGRAPHES_MAX = 12;
export const PARAGRAPHE_TEXTE_MAX = 600;

export const LIBELLES_MODELES: Record<TypeModele, string> = {
  inscription: "Attestation d'inscription",
  scolarite: "Certificat de scolarité",
  reussite: "Attestation de réussite",
};

/** Champs proposés par les boutons de l'éditeur, dans l'ordre d'affichage. */
export const CHAMPS_COMMUNS: { cle: string; libelle: string }[] = [
  { cle: "soussigne", libelle: "Signataire et qualité" },
  { cle: "signataire", libelle: "Nom du signataire" },
  { cle: "qualite", libelle: "Qualité du signataire" },
  { cle: "etablissement", libelle: "Établissement" },
  { cle: "NOM", libelle: "NOM DE L'ÉTUDIANT" },
  { cle: "nom", libelle: "Nom de l'étudiant" },
  { cle: "matricule", libelle: "Matricule" },
  { cle: "Ne", libelle: "Né / Née" },
  { cle: "ne", libelle: "né / née" },
  { cle: "inscrit", libelle: "inscrit / inscrite" },
  { cle: "date_naissance", libelle: "Date de naissance" },
  { cle: "lieu_naissance", libelle: "Lieu de naissance" },
  { cle: "nationalite", libelle: "Nationalité" },
  { cle: "classe", libelle: "Classe" },
  { cle: "niveau", libelle: "Niveau" },
  { cle: "filiere", libelle: "Filière" },
  { cle: "annee", libelle: "Année académique" },
];
export const CHAMPS_REUSSITE: { cle: string; libelle: string }[] = [
  { cle: "semestre", libelle: "Semestre" },
  { cle: "moyenne", libelle: "Moyenne" },
  { cle: "decision", libelle: "Décision du jury" },
];

export function champsDe(type: TypeModele): { cle: string; libelle: string }[] {
  return type === "reussite" ? [...CHAMPS_COMMUNS, ...CHAMPS_REUSSITE] : CHAMPS_COMMUNS;
}

/** Textes de départ : ceux du certificat d'inscription de l'ISAE Thiès, repris pour la scolarité et
 * la réussite. Identiques aux lignes insérées par la migration (un test le vérifie). */
export const MODELES_PAR_DEFAUT: Record<TypeModele, ModeleAttestation> = {
  inscription: {
    titre: "CERTIFICAT D'INSCRIPTION",
    paragraphes: [
      { texte: "Je soussigné(e), {soussigne}, certifie que :", centre: false },
      { texte: "{NOM}", centre: true },
      { texte: "{Ne} le {date_naissance} à {lieu_naissance}", centre: true },
      { texte: "de nationalité {nationalite}, est {inscrit} dans notre établissement en classe de {niveau} de {filiere}, sous le matricule {matricule}, pour l'année académique {annee}.", centre: false },
      { texte: "En foi de quoi, ce présent certificat lui est délivré pour servir et valoir ce que de droit.", centre: false },
    ],
  },
  scolarite: {
    titre: "CERTIFICAT DE SCOLARITÉ",
    paragraphes: [
      { texte: "Je soussigné(e), {soussigne}, certifie que :", centre: false },
      { texte: "{NOM}", centre: true },
      { texte: "{Ne} le {date_naissance} à {lieu_naissance}", centre: true },
      { texte: "matricule {matricule}, est régulièrement {inscrit} dans notre établissement en classe de {niveau} de {filiere} pour l'année académique {annee} et suit assidûment les cours dispensés.", centre: false },
      { texte: "En foi de quoi, ce présent certificat lui est délivré pour servir et valoir ce que de droit.", centre: false },
    ],
  },
  reussite: {
    titre: "ATTESTATION DE RÉUSSITE",
    paragraphes: [
      { texte: "Je soussigné(e), {soussigne}, atteste que :", centre: false },
      { texte: "{NOM}", centre: true },
      { texte: "{Ne} le {date_naissance} à {lieu_naissance}, matricule {matricule}", centre: true },
      { texte: "a subi avec succès les épreuves du {semestre} de {filiere} ({classe}), année académique {annee}, avec une moyenne de {moyenne}/20 et la décision du jury : {decision}.", centre: false },
      { texte: "En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.", centre: false },
    ],
  },
};

export function copieModele(m: ModeleAttestation): ModeleAttestation {
  return { titre: m.titre, paragraphes: m.paragraphes.map((p) => ({ texte: p.texte, centre: p.centre })) };
}

const ACCOLADE = /\{([^{}]*)\}/g;

/** Erreurs d'un modèle, en clair : les mêmes règles que la base. */
export function erreursModele(type: TypeModele, m: ModeleAttestation): string[] {
  const erreurs: string[] = [];
  const titre = m.titre.trim();
  if (!titre) erreurs.push("Donnez un titre au document.");
  if (titre.length > TITRE_MAX) erreurs.push(`Le titre tient en ${TITRE_MAX} caractères.`);
  if (m.paragraphes.length === 0) erreurs.push("Écrivez au moins un paragraphe.");
  if (m.paragraphes.length > PARAGRAPHES_MAX) erreurs.push(`${PARAGRAPHES_MAX} paragraphes au plus.`);
  m.paragraphes.forEach((p, i) => {
    if (p.texte.length > PARAGRAPHE_TEXTE_MAX) erreurs.push(`Paragraphe ${i + 1} : ${PARAGRAPHE_TEXTE_MAX} caractères au plus.`);
  });
  const texte = m.paragraphes.map((p) => p.texte).join("\n");
  const connus = new Set(champsDe(type).map((c) => c.cle));
  const inconnus = [...texte.matchAll(ACCOLADE)].map((x) => x[1]).filter((c) => !connus.has(c));
  for (const c of [...new Set(inconnus)]) {
    erreurs.push(CHAMPS_REUSSITE.some((r) => r.cle === c)
      ? `Le champ {${c}} n'existe que dans l'attestation de réussite.`
      : `Champ inconnu : {${c}}. Utilisez les boutons pour insérer un champ.`);
  }
  if (/[{}]/.test(texte.replace(ACCOLADE, ""))) erreurs.push("Une accolade est seule : un champ s'écrit entre { et }, par exemple {matricule}.");
  if (!/\{(nom|NOM)\}/.test(texte)) erreurs.push("Le nom de l'étudiant ({NOM} ou {nom}) doit figurer dans le texte.");
  if (!/\{matricule\}/.test(texte)) erreurs.push("Le matricule ({matricule}) doit figurer dans le texte.");
  return erreurs;
}

/** Ce que l'attestation connaît de l'étudiant et du signataire, pour remplir les champs. */
export interface ValeursAttestation {
  nom: string;
  matricule: string;
  sexe?: "M" | "F";
  dateNaissance?: string;
  lieuNaissance?: string;
  nationalite?: string;
  classe: string;
  niveau?: string;
  filiere: string;
  annee: string;
  etablissement: string;
  /** Signataire nommé (Signature électronique) ; absent : « le Directeur de … ». */
  signataire?: { nom: string; qualite: string };
  semestre?: string;
  moyenne?: string;
  decision?: string;
}

/** Une information manquante se voit sur le document (à compléter ou à corriger dans la fiche). */
const MANQUANT = "………";

/** « 2003-05-23 » → « 23 mai 2003 », sans décalage de fuseau. */
export function dateLongue(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "";
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][Number(m[2]) - 1];
  return mois ? `${Number(m[3])} ${mois} ${m[1]}` : "";
}

export function valeursDesChamps(v: ValeursAttestation): Record<string, string> {
  const f = v.sexe === "F";
  const m = v.sexe === "M";
  return {
    soussigne: v.signataire ? [v.signataire.nom, v.signataire.qualite].filter(Boolean).join(", ") : `le Directeur de ${v.etablissement}`,
    signataire: v.signataire?.nom || "le Directeur",
    qualite: v.signataire?.qualite || "",
    etablissement: v.etablissement,
    NOM: v.nom.toLocaleUpperCase("fr-FR"),
    nom: v.nom,
    matricule: v.matricule,
    Ne: f ? "Née" : m ? "Né" : "Né(e)",
    ne: f ? "née" : m ? "né" : "né(e)",
    inscrit: f ? "inscrite" : m ? "inscrit" : "inscrit(e)",
    date_naissance: dateLongue(v.dateNaissance),
    lieu_naissance: v.lieuNaissance?.trim() ?? "",
    nationalite: v.nationalite?.trim() ?? "",
    classe: v.classe,
    niveau: v.niveau?.trim() ?? "",
    filiere: v.filiere,
    annee: v.annee,
    semestre: v.semestre ?? "",
    moyenne: v.moyenne ?? "",
    decision: v.decision ?? "",
  };
}

/** Accords et petits mots : affichés tels quels, pas en gras. */
const MOTS_SIMPLES = new Set(["Ne", "ne", "inscrit"]);

/** Corps HTML du document : chaque paragraphe échappé, les champs remplacés par les informations en
 * gras (une information manquante s'affiche « ……… »). */
export function corpsModeleHtml(m: ModeleAttestation, valeurs: Record<string, string>): string {
  return m.paragraphes.map((p) => {
    const html = echapperHtml(p.texte).replace(ACCOLADE, (tout, cle: string) => {
      if (!(cle in valeurs)) return tout;
      const valeur = valeurs[cle].trim();
      if (MOTS_SIMPLES.has(cle)) return echapperHtml(valeur);
      return `<strong>${valeur ? echapperHtml(valeur) : MANQUANT}</strong>`;
    }).replace(/\n/g, "<br />");
    return `<p style="text-align:${p.centre ? "center" : "justify"}">${html}</p>`;
  }).join("\n");
}
