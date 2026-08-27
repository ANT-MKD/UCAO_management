import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { Plus, Eye, Download, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { usePrisesEnCharge } from "@/hooks/usePriseEnChargeStore";
import type { PriseEnChargeRecord } from "@/data/priseEnChargeStore";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

const TODAY = new Date().toISOString().slice(0, 10);
const PAGE_SIZE = 15;

type Statut = "Active" | "Expirée" | "Annulée";

const STATUT_CLS: Record<Statut, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Expirée: "bg-red-50 text-red-700",
  Annulée: "bg-slate-100 text-slate-600",
};

export function statutPEC(r: PriseEnChargeRecord): Statut {
  if (r.annulee) return "Annulée";
  if (r.dateLimite < TODAY) return "Expirée";
  return "Active";
}

export function montantPEC(r: PriseEnChargeRecord): number {
  return r.lignes.reduce((s, l) => s + l.montantPEC, 0);
}

function joursAvantExpiration(r: PriseEnChargeRecord): number {
  return Math.floor((new Date(r.dateLimite).getTime() - Date.now()) / 86400000);
}

interface ColFilters {
  reference: string;
  organisme: string;
  etudiant: string;
  statut: string;
}

const EMPTY_FILTERS: ColFilters = { reference: "", organisme: "", etudiant: "", statut: "" };

const filterInputClass =
  "w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function PriseEnChargePage() {
  const [, setLocation] = useLocation();
  const prisesEnCharge = usePrisesEnCharge();
  const [filters, setFilters] = useState<ColFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const f = filters;
    return prisesEnCharge
      .filter((r) => {
        if (f.reference && !r.reference.toLowerCase().includes(f.reference.toLowerCase())) return false;
        if (f.organisme && !r.organisme.toLowerCase().includes(f.organisme.toLowerCase())) return false;
        if (f.etudiant && !r.etudiant.toLowerCase().includes(f.etudiant.toLowerCase())) return false;
        if (f.statut && !statutPEC(r).toLowerCase().includes(f.statut.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => b.dateSaisie.localeCompare(a.dateSaisie));
  }, [prisesEnCharge, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const actives = prisesEnCharge.filter((r) => statutPEC(r) === "Active");
  const expireSous7 = actives.filter((r) => joursAvantExpiration(r) <= 7).length;
  const expireSous30 = actives.filter((r) => {
    const j = joursAvantExpiration(r);
    return j > 7 && j <= 30;
  }).length;

  const patchFilter = (patch: Partial<ColFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const exportExcel = () => {
    const sheetRows = filtered.map((r) => ({
      Référence: r.reference,
      Organisme: r.organisme,
      Type: r.type === "montant" ? "Montant" : "Pourcentage",
      Montant: montantPEC(r),
      Début: formatShortDate(r.debut),
      Fin: formatShortDate(r.fin),
      "Date limite": formatShortDate(r.dateLimite),
      Étudiant: r.etudiant,
      "Filière/Année": `${r.filiere} / ${r.annee}`,
      Statut: statutPEC(r),
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prises en charge");
    XLSX.writeFile(wb, `prises-en-charge-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les prises en charge" }]}
        title="Les prises en charge"
        subtitle={`${prisesEnCharge.length} prise(s) en charge enregistrée(s)`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="btn-export-excel-pec"
            >
              <Download size={14} /> Export excel
            </button>
            <button
              onClick={() => setLocation("/admin/prises-en-charge/new")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="btn-new-pec"
            >
              <Plus size={15} /> Nouvelle prise en charge
            </button>
          </div>
        }
      />

      {(expireSous7 > 0 || expireSous30 > 0) && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-wrap items-center gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle size={13} /> Prises en charge actives arrivant à expiration
          </span>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600" /> ≤ 7 jours : <strong>{expireSous7}</strong></span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 8–30 jours : <strong>{expireSous30}</strong></span>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Référence</th>
              <th className="text-left px-4 py-3">Organisme</th>
              <th className="text-left px-4 py-3">Étudiant</th>
              <th className="text-center px-4 py-3">Statut</th>
              <th className="text-right px-4 py-3 w-14" />
            </tr>
            <tr className="border-b border-border bg-card">
              <th className="px-3 py-2">
                <input value={filters.reference} onChange={(e) => patchFilter({ reference: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.organisme} onChange={(e) => patchFilter({ organisme: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.etudiant} onChange={(e) => patchFilter({ etudiant: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.statut} onChange={(e) => patchFilter({ statut: e.target.value })} className={filterInputClass} placeholder="Statut" />
              </th>
              <th className="px-3 py-2">
                {Object.values(filters).some(Boolean) && (
                  <button onClick={() => patchFilter(EMPTY_FILTERS)} className="text-[11px] text-muted-foreground hover:text-foreground underline whitespace-nowrap">
                    Réinit.
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-sm text-muted-foreground">
                  Aucune prise en charge ne correspond aux critères sélectionnés.
                </td>
              </tr>
            ) : (
              pageRows.map((r) => {
                const statut = statutPEC(r);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer align-top"
                    onClick={() => setLocation(`/admin/prises-en-charge/${r.id}`)}
                    data-testid={`pec-row-${r.id}`}
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{r.reference}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">
                        {r.type === "montant" ? `Montant : ${formatCFA(montantPEC(r))}` : `Pourcentage : ${r.pourcentage}% (${formatCFA(montantPEC(r))})`}
                      </p>
                      <p className="font-semibold">{r.organisme}</p>
                      <p className="text-xs text-muted-foreground">
                        Début : {formatShortDate(r.debut)} | Fin : {formatShortDate(r.fin)} | Date limite : {formatShortDate(r.dateLimite)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{r.etudiant}</p>
                      <p className="text-xs text-muted-foreground">{r.filiere} / {r.annee}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[statut])}>{statut}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/admin/prises-en-charge/${r.id}`);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Voir le détail"
                        data-testid={`pec-view-${r.id}`}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Page {currentPage} / {totalPages} — {filtered.length} prise(s) en charge
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
