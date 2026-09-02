import * as XLSX from "xlsx";
import type { UserAccountRecord } from "@/data/studentStore";
import { PORTAL_LABELS } from "@/data/portalAccessStore";

export function exportUsersToExcel(comptes: UserAccountRecord[]) {
  const rows = comptes.map((c) => ({
    Nom: c.displayName,
    Identifiant: c.identifier,
    Profil: PORTAL_LABELS[c.role],
    Email: c.email,
    Téléphone: c.telephone ?? "",
    Fonction: c.fonction ?? "",
    Statut: c.actif !== false ? "Actif" : "Désactivé",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Utilisateurs");
  XLSX.writeFile(wb, `utilisateurs-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
