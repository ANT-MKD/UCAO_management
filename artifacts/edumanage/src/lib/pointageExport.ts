import * as XLSX from "xlsx";
import type { PointageRecord } from "@/data/pointageStore";
import { formatDate } from "@/lib/utils";

const STATUT_LABEL: Record<PointageRecord["statut"], string> = {
  brouillon: "Brouillon",
  soumis: "Soumis",
  valide: "Validé",
  rejete: "Rejeté",
};

export function exportPointagesToExcel(
  pointages: PointageRecord[],
  contexte: { coursLabel: string; classeLabel: string; salleLabel: string }[],
) {
  const rows = pointages.map((p, i) => ({
    Date: formatDate(p.date),
    Horaire: `${p.heureDebut}–${p.heureFin}`,
    Cours: contexte[i]?.coursLabel ?? "",
    Classe: contexte[i]?.classeLabel ?? "",
    Type: p.type,
    Salle: contexte[i]?.salleLabel ?? "",
    "Heures pointées": p.volumePointe,
    Statut: STATUT_LABEL[p.statut],
    "Motif de rejet": p.motifRejet ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mon pointage");
  XLSX.writeFile(wb, `mon-pointage-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
