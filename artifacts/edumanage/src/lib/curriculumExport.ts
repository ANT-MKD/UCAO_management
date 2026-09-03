import * as XLSX from "xlsx";
import type { UeRecord, EcRecord } from "@/data/curriculumStore";

const HEADERS = [
  "Code UE", "Unité d'enseignement", "Code EC", "Élément constitutif",
  "CM", "TD", "TP", "TPE", "VHT", "Crédits", "Semestre", "Obligatoire",
] as const;

function ecsForUe(ecs: EcRecord[], ueId: string): EcRecord[] {
  return ecs.filter((e) => e.ueId === ueId);
}

/** Exporte la maquette (UE + leurs EC) exactement au format du modèle d'import (mêmes colonnes)
 * — pour permettre un aller-retour Export → modification dans Excel → Réimport, sans rien
 * ressaisir à la main. Une UE sans EC produit quand même une ligne (colonnes EC vides). */
export function exportCurriculumToExcel(ues: UeRecord[], ecs: EcRecord[], filename = "maquette-ue-ec.xlsx"): void {
  const rows: (string | number)[][] = [[...HEADERS]];
  for (const ue of ues) {
    const ecsUe = ecsForUe(ecs, ue.id);
    if (ecsUe.length === 0) {
      rows.push([ue.code, ue.libelle, "", "", "", "", "", "", "", ue.credits, ue.semestre, ue.obligatoire ? "Oui" : "Non"]);
      continue;
    }
    for (const ec of ecsUe) {
      rows.push([ue.code, ue.libelle, ec.code, ec.libelle, ec.volCm, ec.volTd, ec.volTp, ec.volTpe, ec.vht, ue.credits, ue.semestre, ue.obligatoire ? "Oui" : "Non"]);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Maquette");
  XLSX.writeFile(wb, filename);
}

export interface MaquetteMeta {
  titre: string;
}

/** Document HTML partagé par l'export PDF (impression navigateur) et Word (téléchargement direct)
 * — jamais deux mises en page à maintenir séparément pour le même contenu. */
function buildMaquetteHtml(ues: UeRecord[], ecs: EcRecord[], meta: MaquetteMeta, autoprint: boolean): string {
  const groupes = ues
    .map((ue) => {
      const ecsUe = ecsForUe(ecs, ue.id);
      const ecRows = ecsUe.length > 0
        ? ecsUe
            .map(
              (ec) => `<tr>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:10px;">${ec.code}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;">${ec.libelle}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${ec.volCm}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${ec.volTd}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${ec.volTp}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${ec.volTpe}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;">${ec.vht}</td>
        </tr>`,
            )
            .join("")
        : `<tr><td colspan="7" style="padding:5px 8px;border-bottom:1px solid #e5e7eb;color:#9ca3af;font-style:italic;">Aucun EC</td></tr>`;
      return `
      <tr><td colspan="7" style="padding:10px 8px 4px;font-weight:700;font-family:Arial,sans-serif;font-size:12px;color:#4f46e5;">
        ${ue.code} — ${ue.libelle} (${ue.credits} crédits, ${ue.semestre}, ${ue.obligatoire ? "obligatoire" : "libre"})
      </td></tr>
      ${ecRows}`;
    })
    .join("");

  const totalCredits = ues.reduce((s, u) => s + u.credits, 0);
  const totalVht = ecs.filter((e) => ues.some((u) => u.id === e.ueId)).reduce((s, e) => s + e.vht, 0);

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Maquette pédagogique — ${meta.titre}</title>
  <style>
    @page { size: A4 landscape; margin: 16mm 14mm; }
    body { font-family: 'Georgia', serif; font-size: 12px; color: #111827; }
    h1 { font-family: Arial, sans-serif; font-size: 18px; color: #4f46e5; margin-bottom: 2px; }
    .subtitle { font-family: Arial, sans-serif; font-size: 12px; color: #6b7280; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #4f46e5; color: white; font-family: Arial, sans-serif; font-size: 10px; text-transform: uppercase; padding: 8px; text-align: left; }
    .meta { background: #f8faff; border: 1px solid #e0e7ff; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-family: Arial, sans-serif; font-size: 11px; }
  </style>
  </head><body>
    <h1>Maquette pédagogique</h1>
    <div class="subtitle">${meta.titre}</div>
    <div class="meta"><strong>${ues.length}</strong> UE — <strong>${totalCredits}</strong> crédits ECTS — <strong>${totalVht}</strong>h VHT</div>
    <table>
      <thead><tr><th>Code EC</th><th>Élément constitutif</th><th>CM</th><th>TD</th><th>TP</th><th>TPE</th><th>VHT</th></tr></thead>
      <tbody>${groupes}</tbody>
    </table>
    ${autoprint ? "<script>window.onload = function(){ window.print(); };</script>" : ""}
  </body></html>`;
}

/** Ouvre la maquette dans un nouvel onglet et déclenche l'impression — l'utilisateur choisit
 * "Enregistrer en PDF" dans la boîte de dialogue du navigateur, comme pour les autres documents
 * imprimables de l'application (PV de délibération, quittances...). */
export function exportMaquettePdf(ues: UeRecord[], ecs: EcRecord[], meta: MaquetteMeta): void {
  const win = window.open("", "_blank", "width=1100,height=850");
  if (!win) return;
  win.document.write(buildMaquetteHtml(ues, ecs, meta, true));
  win.document.close();
}

/** Fichier .doc téléchargé directement (Word ouvre nativement un document HTML portant cette
 * extension) — pas de bibliothèque supplémentaire nécessaire pour un export mise en page simple. */
export function exportMaquetteWord(ues: UeRecord[], ecs: EcRecord[], meta: MaquetteMeta, filename = "maquette-ue-ec.doc"): void {
  const html = buildMaquetteHtml(ues, ecs, meta, false);
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
