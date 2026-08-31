import { formatCFA } from "@/lib/utils";

export interface PrintDocumentLigne {
  label: string;
  montant: number;
}

export interface PrintDocumentSummaryRow {
  label: string;
  montant: number;
  /** "due" met la ligne en rouge (ex: reste à payer) ; "total" la met en évidence (fond marine). */
  emphasis?: "due" | "total";
}

export interface PrintDocumentArgs {
  /** Libellé affiché en grand en haut à droite : "REÇU", "DEVIS", "DÉCOMPTE"... */
  badge: string;
  numero: string;
  numeroLabel?: string;
  date: string;
  dateLabel?: string;
  /** Lignes supplémentaires sous la date/le numéro (ex: date limite). */
  metaDroiteExtra?: { label: string; valeur: string }[];

  destinataireLabel?: string;
  destinataireNom: string;
  /** Lignes secondaires sous le nom du destinataire (matricule, classe, téléphone...). */
  destinataireLignes?: string[];

  /** Bloc à droite, en vis-à-vis du destinataire (statut, filière...). */
  metaDroiteLabel?: string;
  metaDroiteValeur?: string;
  metaDroiteSousLignes?: string[];

  colonneLabel?: string;
  lignes?: PrintDocumentLigne[];
  /** Remplace entièrement le tableau simple (label/montant) par un tableau à colonnes
   * personnalisées, pour les documents listant plusieurs bénéficiaires/lignes détaillées
   * (ex: N° quittance, étudiant, montant). */
  tableauPersonnalise?: { entetes: string[]; lignes: string[][] };
  /** Remplace le tableau (et l'encart/récap) par un bloc de texte libre (HTML), pour les
   * documents narratifs sans lignes chiffrées (ex: attestation, certificat). */
  corps?: string;

  /** Petit encart en bas à gauche (méthode de paiement, banque, remarques...). */
  encartLabel?: string;
  encartLignes?: string[];

  summary?: PrintDocumentSummaryRow[];

  messageMerci?: string;
  signatureLabel?: string;
}

const STYLE = `
* { box-sizing: border-box; }
body{font-family:'Segoe UI',Arial,sans-serif;max-width:760px;margin:32px auto;padding:48px;color:#1a1a2e;font-size:13px}
.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
.brand{display:flex;align-items:center;gap:12px}
.mark{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#4f46e5,#22c1a0);flex-shrink:0}
.brand h1{font-size:16px;margin:0;color:#1a1a2e}
.brand p{font-size:11px;margin:2px 0 0;color:#888}
.doc-title{text-align:right}
.doc-title h2{font-size:28px;letter-spacing:2px;margin:0;color:#4f46e5;font-weight:800}
.doc-title p{font-size:11px;margin:6px 0 0;color:#888}
.doc-title strong{color:#1a1a2e}
.meta-row{display:flex;justify-content:space-between;margin-bottom:28px;gap:24px}
.meta-row .label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:4px}
.meta-row .name{font-size:14px;font-weight:700;color:#1a1a2e}
.meta-row .sub{font-size:12px;color:#555;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th{background:#1a2f5e;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:11px 14px}
th.num,td.num{text-align:right}
td{padding:11px 14px;border-bottom:1px solid #ececf2;font-size:13px}
tbody tr:last-child td{border-bottom:none}
.bottom{display:flex;justify-content:space-between;gap:32px;align-items:flex-start;margin-top:8px}
.encart{font-size:12px;color:#444;max-width:260px}
.encart .label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:6px;font-weight:700}
.encart div{margin:2px 0}
.summary{min-width:270px;border:1px solid #ececf2;border-radius:8px;overflow:hidden}
.summary .row{display:flex;justify-content:space-between;gap:16px;padding:9px 14px;font-size:12px;background:#f7f8fc;white-space:nowrap}
.summary .row + .row{border-top:1px solid #ececf2}
.summary .row.due{color:#c0392b;font-weight:600}
.summary .row.total{background:#1a2f5e;color:#fff;font-weight:800;font-size:14px}
.corps{font-size:14px;line-height:1.9;text-align:justify;margin:28px 0}
.corps p{margin:0 0 14px}
.thanks{margin-top:32px;font-size:13px;font-weight:600;color:#1a2f5e}
.footer{margin-top:56px;display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;color:#888}
.signature{text-align:center}
.signature .line{width:170px;border-top:1px solid #ccc;margin-bottom:6px}
.signature strong{color:#1a1a2e;font-size:12px}
@media print { body{margin:0} }
`;

/** Génère le document HTML imprimable (facture/reçu/devis/décompte...) avec la même mise en page
 * pour tous les documents financiers de l'app : en-tête (logo + titre du document), bloc
 * destinataire/méta, tableau des lignes, encart + récapitulatif, remerciement, signature. */
export function buildPrintDocumentHtml(args: PrintDocumentArgs): string {
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.numero}</title>
<style>${STYLE}</style></head><body>
<div class="top">
  <div class="brand">
    <div class="mark"></div>
    <div><h1>Institut Supérieur EduManage</h1><p>Dakar, Sénégal</p></div>
  </div>
  <div class="doc-title">
    <h2>${args.badge}</h2>
    <p>${args.dateLabel ?? "Date"} : <strong>${args.date}</strong></p>
    <p>${args.numeroLabel ?? "N°"} : <strong>${args.numero}</strong></p>
    ${(args.metaDroiteExtra ?? []).map((m) => `<p>${m.label} : <strong>${m.valeur}</strong></p>`).join("")}
  </div>
</div>

<div class="meta-row">
  <div>
    <div class="label">${args.destinataireLabel ?? "Adressé à"}</div>
    <div class="name">${args.destinataireNom}</div>
    ${(args.destinataireLignes ?? []).map((l) => `<div class="sub">${l}</div>`).join("")}
  </div>
  ${args.metaDroiteLabel ? `
  <div style="text-align:right">
    <div class="label">${args.metaDroiteLabel}</div>
    <div class="name">${args.metaDroiteValeur ?? ""}</div>
    ${(args.metaDroiteSousLignes ?? []).map((l) => `<div class="sub">${l}</div>`).join("")}
  </div>` : ""}
</div>

${args.corps ? `
<div class="corps">${args.corps}</div>` : args.tableauPersonnalise ? `
<table>
<thead><tr>${args.tableauPersonnalise.entetes.map((e, i) => `<th${i === args.tableauPersonnalise!.entetes.length - 1 ? ' class="num"' : ""}>${e}</th>`).join("")}</tr></thead>
<tbody>
${args.tableauPersonnalise.lignes.map((row) => `<tr>${row.map((cell, i) => `<td${i === row.length - 1 ? ' class="num"' : ""}>${cell}</td>`).join("")}</tr>`).join("")}
</tbody>
</table>` : `
<table>
<thead><tr><th>${args.colonneLabel ?? "Rubrique"}</th><th class="num">Montant</th></tr></thead>
<tbody>
${(args.lignes ?? []).map((l) => `<tr><td>${l.label}</td><td class="num">${formatCFA(l.montant)}</td></tr>`).join("")}
</tbody>
</table>`}

${!args.corps && (args.encartLabel || (args.summary && args.summary.length > 0)) ? `
<div class="bottom">
  ${args.encartLabel ? `
  <div class="encart">
    <div class="label">${args.encartLabel}</div>
    ${(args.encartLignes ?? []).map((l) => `<div>${l}</div>`).join("")}
  </div>` : "<div></div>"}
  ${args.summary && args.summary.length > 0 ? `
  <div class="summary">
    ${args.summary.map((r) => `<div class="row${r.emphasis ? ` ${r.emphasis}` : ""}"><span>${r.label}</span><span>${formatCFA(r.montant)}</span></div>`).join("")}
  </div>` : ""}
</div>` : ""}

${args.messageMerci !== "" ? `<p class="thanks">${args.messageMerci ?? "Merci pour votre confiance !"}</p>` : ""}

<div class="footer">
  <div>
    Institut Supérieur EduManage<br />
    Dakar, Sénégal<br />
    Fait le ${now}
  </div>
  <div class="signature">
    <div class="line"></div>
    <strong>${args.signatureLabel ?? "Le Responsable Financier"}</strong>
  </div>
</div>
</body></html>`;
}
