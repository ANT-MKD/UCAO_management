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
