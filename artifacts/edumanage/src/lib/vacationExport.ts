import * as XLSX from "xlsx";
import type { VacationRecord } from "@/data/vacationStore";
import { formatCFA } from "@/lib/utils";

export function exportVacationsToExcel(vacations: VacationRecord[]) {
  const rows = vacations.map((v) => ({
    Mois: v.mois,
    Enseignant: v.enseignant,
    Modules: v.modules.join(", "),
    "Heures CM": v.heuresCm,
    "Heures TD": v.heuresTd,
    "Taux horaire": v.tauxHoraire,
    "Montant total": formatCFA(v.montantTotal),
    Statut: v.statut,
    Moyen: v.moyen,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vacations");
  XLSX.writeFile(wb, `vacations-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
