import type { TeacherContractRecord } from "@/data/teacherContractStore";
import type { EnseignantRecord } from "@/lib/teacherUtils";
import { formatCFA, formatDate } from "@/lib/utils";

export interface ContractPrintRow {
  coursLabel: string;
  classeLabel: string;
  modeLabel: string;
  montant: number;
}

const STATUT_LABEL: Record<"actif" | "expire" | "resilie", string> = {
  actif: "Actif",
  expire: "Expiré",
  resilie: "Résilié",
};

export function buildContractHtml(
  contract: TeacherContractRecord,
  teacher: EnseignantRecord | undefined,
  rows: ContractPrintRow[],
  statut: "actif" | "expire" | "resilie",
): string {
  const total = rows.reduce((sum, r) => sum + r.montant, 0);
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const avenantsHtml =
    contract.avenants.length === 0
      ? ""
      : `<div class="avenants">
          <h4>Avenants</h4>
          ${contract.avenants
            .map(
              (a) => `<div class="avenant-item">
                <strong>Avenant n°${a.numero}</strong> — ${formatDate(a.date)}<br>
                ${a.motif}<br>
                Fin de contrat : ${formatDate(a.dateFinAvant)} → ${formatDate(a.dateFinApres)}
              </div>`,
            )
            .join("")}
        </div>`;

  const resiliationHtml =
    contract.resilie && contract.motifResiliation
      ? `<p style="color:#b91c1c"><strong>Contrat résilié</strong> le ${contract.dateResiliation ? formatDate(contract.dateResiliation) : ""} — ${contract.motifResiliation}</p>`
      : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Contrat ${contract.id}</title>
<style>
body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:40px;color:#1a1a1a}
.header{text-align:center;border-bottom:3px double #4f46e5;padding-bottom:20px;margin-bottom:30px}
.header h1{font-size:22px;color:#4f46e5;margin:0}
.header p{font-size:12px;color:#666;margin:4px 0}
.title{text-align:center;font-size:18px;font-weight:bold;margin:30px 0;text-decoration:underline}
.meta{display:flex;justify-content:space-between;font-size:13px;margin-bottom:20px}
.body{font-size:14px;line-height:1.7;text-align:justify}
table{width:100%;border-collapse:collapse;margin:20px 0;font-size:13px}
th,td{border:1px solid #ccc;padding:8px 10px;text-align:left}
th{background:#f4f4f8}
.total-row td{font-weight:bold;background:#f9f9fc}
.avenants{margin-top:30px}
.avenants h4{font-size:14px;margin-bottom:8px}
.avenant-item{border-left:3px solid #4f46e5;padding:8px 12px;margin-bottom:10px;background:#f9f9fc;font-size:12px}
.signatures{display:flex;justify-content:space-between;margin-top:80px;font-size:13px}
.signatures div{width:220px;text-align:center;border-top:1px solid #333;padding-top:8px}
</style></head><body>
<div class="header"><h1>Institut Supérieur EduManage</h1><p>Dakar, Sénégal · Agrément Ministère de l'Enseignement Supérieur</p></div>
<div class="title">CONTRAT D'ENSEIGNEMENT N° ${contract.id}</div>
<div class="meta">
  <div>Année académique : <strong>${contract.annee}</strong></div>
  <div>Statut : <strong>${STATUT_LABEL[statut]}</strong></div>
</div>
<div class="body">
<p>Entre l'Institut Supérieur EduManage, ci-après « l'Établissement », d'une part,</p>
<p>Et <strong>${teacher ? `${teacher.prenom} ${teacher.nom}` : "le professeur"}</strong>${teacher ? ` (${teacher.grade}, matricule ${teacher.matricule})` : ""}, ci-après « le Professeur », d'autre part,</p>
<p>Il est convenu ce qui suit : le présent contrat couvre la période du <strong>${formatDate(contract.dateDebut)}</strong> au <strong>${formatDate(contract.dateFin)}</strong>, pour l'année académique ${contract.annee}, selon la répartition des enseignements ci-dessous.</p>
</div>
${resiliationHtml}
<table>
<thead><tr><th>Cours</th><th>Classe</th><th>Mode de paiement</th><th>Montant</th></tr></thead>
<tbody>
${rows
  .map(
    (r) =>
      `<tr><td>${r.coursLabel}</td><td>${r.classeLabel}</td><td>${r.modeLabel}</td><td>${formatCFA(r.montant)}</td></tr>`,
  )
  .join("")}
<tr class="total-row"><td colspan="3">Montant total</td><td>${formatCFA(total)}</td></tr>
</tbody>
</table>
${avenantsHtml}
<div class="signatures"><div>Le Professeur</div><div>Le Directeur</div></div>
<p style="margin-top:40px;font-size:11px;color:#666">Fait à Dakar, le ${now}</p>
</body></html>`;
}

export function printContract(
  contract: TeacherContractRecord,
  teacher: EnseignantRecord | undefined,
  rows: ContractPrintRow[],
  statut: "actif" | "expire" | "resilie",
): void {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(buildContractHtml(contract, teacher, rows, statut));
  win.document.close();
  win.print();
}
