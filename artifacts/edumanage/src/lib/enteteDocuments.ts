import { getEtablissement, type EtablissementInfo, type LigneEntete } from "@/data/etablissementStore";
import type { SignatureConfig } from "@/data/signatureConfigStore";

/** En-tête et pied de page des documents scolaires (attestations, relevés et bulletins,
 * procès-verbaux de délibération), réglés dans Paramètres généraux → Documents officiels.
 * Tant que la forme reste « standard » (ou qu'il manque l'image ou le texte), chaque document garde
 * sa présentation d'origine : ces fonctions rendent alors null. Les limites sont celles que la base
 * contrôle (migration entete_documents). */

export const ENTETE_LIGNES_MAX = 6;
export const ENTETE_TEXTE_MAX = 120;
export const PIED_LIGNES_MAX = 3;
export const PIED_TEXTE_MAX = 160;
export const VILLE_MAX = 60;
/** L'espace de fichiers de l'établissement accepte 2 Mo par image. */
export const IMAGE_DOCUMENT_MAX_OCTETS = 1_900_000;
export const TYPES_IMAGE_DOCUMENT = ["image/png", "image/jpeg", "image/webp"];

export const TAILLES_ENTETE: Record<LigneEntete["taille"], { libelle: string; css: string }> = {
  grande: { libelle: "Grande", css: "17px" },
  moyenne: { libelle: "Moyenne", css: "14px" },
  petite: { libelle: "Petite", css: "11.5px" },
};
export const STYLES_ENTETE: Record<LigneEntete["style"], { libelle: string; css: string }> = {
  gras: { libelle: "Gras", css: "font-weight:700;font-style:normal" },
  normal: { libelle: "Normal", css: "font-weight:400;font-style:normal" },
  italique: { libelle: "Italique", css: "font-weight:400;font-style:italic" },
};
export const COULEURS_ENTETE: Record<LigneEntete["couleur"], { libelle: string; css: string }> = {
  noir: { libelle: "Noir", css: "#1a1a1a" },
  bleu: { libelle: "Bleu marine", css: "#1f3a7a" },
  bordeaux: { libelle: "Bordeaux", css: "#8b1a1a" },
};

/** Lignes proposées par le bouton « Exemple » : celles des documents de l'UCAO-ISAE Thiès. */
export const LIGNES_ENTETE_EXEMPLE: LigneEntete[] = [
  { texte: "Université Catholique de l'Afrique de l'Ouest (UCAO)", taille: "grande", style: "gras", couleur: "bordeaux" },
  { texte: "Faculté des Sciences de Gestion", taille: "moyenne", style: "gras", couleur: "bordeaux" },
  { texte: "Science - Foi - Action", taille: "petite", style: "italique", couleur: "bordeaux" },
  { texte: "Institut Supérieur d'Administration des Entreprises Thiès", taille: "moyenne", style: "gras", couleur: "bleu" },
  { texte: "« École affiliée »", taille: "petite", style: "italique", couleur: "noir" },
];

export const LIGNE_ENTETE_VIDE: LigneEntete = { texte: "", taille: "moyenne", style: "normal", couleur: "noir" };

export function echapperHtml(texte: string): string {
  return texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const lignesUtiles = (etab: EtablissementInfo) => (etab.enteteLignes ?? []).filter((l) => l.texte.trim()).slice(0, ENTETE_LIGNES_MAX);

/** Vrai quand l'établissement a réglé un en-tête utilisable (bannière déposée, ou en-tête composé
 * avec au moins une ligne ou un logo). */
export function enteteScolaireActif(etab: EtablissementInfo = getEtablissement()): boolean {
  if (etab.enteteForme === "banniere") return !!etab.banniereDataUrl;
  if (etab.enteteForme === "compose") return lignesUtiles(etab).length > 0 || !!etab.logoDataUrl || !!etab.logoDroitDataUrl;
  return false;
}

/** En-tête des documents scolaires, ou null : le document garde alors son en-tête d'origine. */
export function enteteScolaireHtml(etab: EtablissementInfo = getEtablissement()): string | null {
  if (!enteteScolaireActif(etab)) return null;
  if (etab.enteteForme === "banniere") {
    return `<div class="edm-entete" style="margin:0 0 20px;-webkit-print-color-adjust:exact;print-color-adjust:exact">`
      + `<img src="${echapperHtml(etab.banniereDataUrl!)}" alt="" style="display:block;width:100%;height:auto" /></div>`;
  }
  const logo = (src?: string) => src
    ? `<img src="${echapperHtml(src)}" alt="" style="height:80px;max-width:120px;object-fit:contain;flex-shrink:0" />`
    : `<div style="width:80px;flex-shrink:0"></div>`;
  const lignes = lignesUtiles(etab).map((l) => {
    const taille = TAILLES_ENTETE[l.taille]?.css ?? TAILLES_ENTETE.moyenne.css;
    const style = STYLES_ENTETE[l.style]?.css ?? STYLES_ENTETE.normal.css;
    const couleur = COULEURS_ENTETE[l.couleur]?.css ?? COULEURS_ENTETE.noir.css;
    return `<div style="font-size:${taille};${style};color:${couleur};line-height:1.25">${echapperHtml(l.texte.trim())}</div>`;
  }).join("");
  const cadre = etab.enteteCadre ? "border:1.5px solid #3b4a8a;border-radius:10px;padding:10px 16px;" : "padding:4px 0;";
  return `<div class="edm-entete" style="display:flex;align-items:center;justify-content:space-between;gap:14px;${cadre}margin:0 0 20px;`
    + `font-family:Georgia,'Times New Roman',serif;-webkit-print-color-adjust:exact;print-color-adjust:exact">`
    + `${logo(etab.logoDataUrl)}<div style="flex:1;text-align:center">${lignes}</div>${logo(etab.logoDroitDataUrl)}</div>`;
}

/** Pied de page des documents scolaires, ou null s'il n'est pas réglé. */
export function piedScolaireHtml(etab: EtablissementInfo = getEtablissement()): string | null {
  const lignes = (etab.piedLignes ?? []).map((l) => l.trim()).filter(Boolean).slice(0, PIED_LIGNES_MAX);
  if (lignes.length === 0) return null;
  return `<div class="edm-pied" style="border-top:1.5px solid #8b1a1a;padding-top:6px;margin-top:28px;text-align:center;`
    + `font-family:Arial,sans-serif;font-size:10.5px;color:#333;line-height:1.5">${lignes.map((l) => `<div>${echapperHtml(l)}</div>`).join("")}</div>`;
}

/** Nom et qualité du signataire d'un document, quand sa signature est activée et nommée. */
export function signataireDe(sig: SignatureConfig | undefined): { nom: string; qualite: string } | null {
  const nom = sig?.actif ? sig.signataireNom.trim() : "";
  return nom ? { nom, qualite: sig!.signataireQualite.trim() } : null;
}

/** « Je soussigné(e), M. Laurent Dominique SAGNA, Responsable de la scolarité, certifie… » ;
 * sans signataire nommé, la phrase d'origine (« le Directeur de … »). */
export function phraseSoussigne(sig: SignatureConfig | undefined, nomEtablissement: string): string {
  const s = signataireDe(sig);
  if (!s) return `Je soussigné(e), le Directeur de ${echapperHtml(nomEtablissement)}, certifie par la présente que :`;
  return `Je soussigné(e), <strong>${echapperHtml(s.nom)}</strong>${s.qualite ? `, ${echapperHtml(s.qualite)}` : ""}, certifie par la présente que :`;
}

export interface DocumentScolaire {
  /** Titre centré, par exemple « ATTESTATION D'INSCRIPTION ». */
  titre: string;
  /** Référence du document (numéro), en petit sous le titre. */
  reference?: string;
  /** Corps du document, en HTML déjà échappé par l'appelant. */
  corps: string;
  /** « Fait à Thiès, le 7 janvier 2026 ». */
  faitLe: string;
  signature: { qualite?: string; nom?: string; imageDataUrl?: string };
}

/** Document scolaire d'une page à l'en-tête de l'établissement (forme bannière ou composée) :
 * en-tête, titre, corps, « Fait à », signature, pied de page en bas de la page. */
export function documentScolaireHtml(doc: DocumentScolaire, etab: EtablissementInfo = getEtablissement()): string {
  const entete = enteteScolaireHtml(etab) ?? "";
  const pied = piedScolaireHtml(etab) ?? "";
  const { qualite, nom, imageDataUrl } = doc.signature;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${echapperHtml(doc.titre)}${doc.reference ? ` — ${echapperHtml(doc.reference)}` : ""}</title>
<style>
@page { size: A4; margin: 12mm 15mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; color: #111; font-size: 14px; }
.page { min-height: 270mm; display: flex; flex-direction: column; max-width: 780px; margin: 0 auto; }
.titre { text-align: center; font-size: 22px; font-weight: 800; letter-spacing: 1px; text-decoration: underline; margin: 14px 0 4px; }
.reference { text-align: center; font-size: 11px; color: #555; margin-bottom: 26px; }
.corps { font-size: 14.5px; line-height: 1.9; text-align: justify; }
.corps p { margin: 0 0 14px; }
.fait { text-align: right; margin-top: 26px; font-size: 13.5px; }
.signature { margin-left: auto; margin-top: 10px; text-align: center; min-width: 240px; }
.signature img { display: block; margin: 6px auto; max-height: 90px; max-width: 220px; object-fit: contain; }
.signature .qualite { font-size: 13px; }
.signature .nom { font-weight: 700; font-size: 13.5px; }
.bas { margin-top: auto; }
@media screen { body { padding: 24px; } }
</style></head><body><div class="page">
${entete}
<div class="titre">${echapperHtml(doc.titre)}</div>
${doc.reference ? `<div class="reference">${echapperHtml(doc.reference)}</div>` : `<div class="reference"></div>`}
<div class="corps">${doc.corps}</div>
<div class="fait">${echapperHtml(doc.faitLe)}</div>
<div class="signature">
  ${qualite ? `<div class="qualite">${echapperHtml(qualite)}</div>` : ""}
  ${imageDataUrl ? `<img src="${echapperHtml(imageDataUrl)}" alt="" />` : `<div style="height:60px"></div>`}
  ${nom ? `<div class="nom">${echapperHtml(nom)}</div>` : ""}
</div>
<div class="bas">${pied}</div>
</div></body></html>`;
}

/** Erreurs de saisie des Documents officiels (les mêmes limites que la base), en clair. */
export function erreursReglagesDocuments(r: Pick<EtablissementInfo, "enteteForme" | "banniereDataUrl" | "enteteLignes" | "piedLignes" | "ville">): string[] {
  const erreurs: string[] = [];
  if (r.enteteForme === "banniere" && !r.banniereDataUrl) erreurs.push("Choisissez l'image de la bannière, ou une autre forme d'en-tête.");
  if (r.enteteLignes.length > ENTETE_LIGNES_MAX) erreurs.push(`L'en-tête compte ${ENTETE_LIGNES_MAX} lignes au plus.`);
  r.enteteLignes.forEach((l, i) => {
    if (l.texte.trim().length > ENTETE_TEXTE_MAX) erreurs.push(`Ligne ${i + 1} de l'en-tête : ${ENTETE_TEXTE_MAX} caractères au plus.`);
  });
  if (r.piedLignes.length > PIED_LIGNES_MAX) erreurs.push(`Le pied de page compte ${PIED_LIGNES_MAX} lignes au plus.`);
  r.piedLignes.forEach((l, i) => {
    if (l.trim().length > PIED_TEXTE_MAX) erreurs.push(`Ligne ${i + 1} du pied de page : ${PIED_TEXTE_MAX} caractères au plus.`);
  });
  if (r.ville.trim().length > VILLE_MAX) erreurs.push(`La ville tient en ${VILLE_MAX} caractères.`);
  return erreurs;
}

/** Lit une image de document (bannière, logo) sans la recompresser : le texte d'une bannière reste
 * net. PNG, JPEG ou WebP, 1,9 Mo au plus. Rejette avec un message prêt à afficher. */
export function lireImageDocument(fichier: File): Promise<string> {
  if (!TYPES_IMAGE_DOCUMENT.includes(fichier.type)) {
    return Promise.reject(new Error("Choisissez une image PNG, JPEG ou WebP."));
  }
  if (fichier.size > IMAGE_DOCUMENT_MAX_OCTETS) {
    return Promise.reject(new Error(`Image trop lourde (${(fichier.size / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo) : 1,9 Mo au plus.`));
  }
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(new Error("Image illisible."));
    lecteur.readAsDataURL(fichier);
  });
}
