import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import {
  Plus,
  Eye,
  Download,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useEncaissementsPEC } from "@/hooks/useEncaissementPECStore";
import type { EncaissementPECRecord } from "@/data/encaissementPECStore";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

export function montantEncaissement(r: EncaissementPECRecord): number {
  return r.lignes.reduce((s, l) => s + l.montant, 0);
}

export function statutEncaissementPEC(r: EncaissementPECRecord): "Validé" | "Annulé" {
  return r.annulee ? "Annulé" : "Validé";
}

const STATUT_CLS: Record<string, string> = {
  Validé: "bg-emerald-50 text-emerald-700",
  Annulé: "bg-red-50 text-red-700",
};

interface ColFilters {
  reference: string;
  organisme: string;
  mode: string;
  statut: string;
}

const EMPTY_FILTERS: ColFilters = { reference: "", organisme: "", mode: "", statut: "" };

const filterInputClass =
  "w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function EncaissementPECPage() {
  const [, setLocation] = useLocation();
  const encaissements = useEncaissementsPEC();
  const [filters, setFilters] = useState<ColFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const patchFilter = (patch: Partial<ColFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const filtered = useMemo(() => {
    const f = filters;
    return encaissements
      .filter((r) => {
        if (f.reference && !r.reference.toLowerCase().includes(f.reference.toLowerCase())) return false;
        if (f.organisme && !r.organisme.toLowerCase().includes(f.organisme.toLowerCase())) return false;
        if (f.mode && !r.modePaiement.toLowerCase().includes(f.mode.toLowerCase())) return false;
        if (f.statut && statutEncaissementPEC(r) !== f.statut) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [encaissements, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstRowNum = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRowNum = Math.min(filtered.length, currentPage * pageSize);

  const exportExcel = () => {
    const sheetRows = filtered.map((r) => ({
      Référence: r.reference,
      Organisme: r.organisme,
      Date: formatShortDate(r.date),
      "Mode de paiement": r.modePaiement,
      "Référence bancaire": r.referenceBancaire ?? "",
      Montant: montantEncaissement(r),
      Statut: statutEncaissementPEC(r),
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Encaissements PEC");
    XLSX.writeFile(wb, `encaissements-pec-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les encaissements PEC" }]}
        title="Les encaissements PEC"
        subtitle={`${encaissements.length} encaissement(s) enregistré(s)`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="btn-export-excel-enc-pec"
            >
              <Download size={14} /> Export excel
            </button>
            <button
              onClick={() => setLocation("/admin/encaissements-pec/new")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="btn-new-enc-pec"
            >
              <Plus size={15} /> Nouvel encaissement de PEC
            </button>
          </div>
        }
      />

      <div className="bg-card border border-border rounded-xl overflow-x-auto" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Référence</th>
              <th className="text-left px-4 py-3">Organisme</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Mode de paiement</th>
              <th className="text-right px-4 py-3">Montant</th>
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
              <th className="px-3 py-2" />
              <th className="px-3 py-2">
                <input value={filters.mode} onChange={(e) => patchFilter({ mode: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">
                <select value={filters.statut} onChange={(e) => patchFilter({ statut: e.target.value })} className={filterInputClass}>
                  <option value="">Statut</option>
                  <option value="Validé">Validé</option>
                  <option value="Annulé">Annulé</option>
                </select>
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
                <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                  Aucun encaissement ne correspond aux critères sélectionnés.
                </td>
              </tr>
            ) : (
              pageRows.map((r) => {
                const statut = statutEncaissementPEC(r);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setLocation(`/admin/encaissements-pec/${r.id}`)}
                    data-testid={`enc-pec-row-${r.id}`}
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{r.reference}</td>
                    <td className="px-4 py-3">{r.organisme}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatShortDate(r.date)}</td>
                    <td className="px-4 py-3">{r.modePaiement}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCFA(montantEncaissement(r))}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[statut])}>{statut}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/admin/encaissements-pec/${r.id}`);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Voir le détail"
                        data-testid={`enc-pec-view-${r.id}`}
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

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Afficher</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 border border-border rounded-lg bg-background text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>
              Enregistrements {firstRowNum} - {lastRowNum} sur {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Page {currentPage} sur {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors">
                <ChevronsLeft size={14} />
              </button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors">
                <ChevronRight size={14} />
              </button>
              <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors">
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
