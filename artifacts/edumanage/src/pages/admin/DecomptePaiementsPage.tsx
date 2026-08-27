import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import {
  Plus,
  Eye,
  Download,
  SlidersHorizontal,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useDecomptePaiements } from "@/hooks/useDecomptePaiementStore";
import { useModesPaiementFinance } from "@/hooks/useFinanceSettingsStore";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

interface ColFilters {
  reference: string;
  professeur: string;
  decompte: string;
  statut: string;
}

const EMPTY_FILTERS: ColFilters = { reference: "", professeur: "", decompte: "", statut: "" };

const filterInputClass =
  "w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function DecomptePaiementsPage() {
  const [, setLocation] = useLocation();
  const paiements = useDecomptePaiements();
  const modesPaiement = useModesPaiementFinance();
  const [filters, setFilters] = useState<ColFilters>(EMPTY_FILTERS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [montantMin, setMontantMin] = useState("");
  const [montantMax, setMontantMax] = useState("");
  const [moyenFilter, setMoyenFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const patchFilter = (patch: Partial<ColFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const filtered = useMemo(() => {
    return paiements
      .filter((p) => {
        if (filters.reference && !p.reference.toLowerCase().includes(filters.reference.toLowerCase())) return false;
        if (filters.professeur && !p.professeur.toLowerCase().includes(filters.professeur.toLowerCase())) return false;
        if (filters.decompte && !p.decompteReference.toLowerCase().includes(filters.decompte.toLowerCase())) return false;
        if (filters.statut) {
          const statut = p.annulee ? "Annulé" : "Validé";
          if (statut !== filters.statut) return false;
        }
        if (dateDebut && p.date < dateDebut) return false;
        if (dateFin && p.date > dateFin) return false;
        if (montantMin && p.montant < Number(montantMin)) return false;
        if (montantMax && p.montant > Number(montantMax)) return false;
        if (moyenFilter && p.moyen !== moyenFilter) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [paiements, filters, dateDebut, dateFin, montantMin, montantMax, moyenFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstRowNum = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRowNum = Math.min(filtered.length, currentPage * pageSize);

  const advancedActiveCount = [dateDebut, dateFin, montantMin, montantMax, moyenFilter].filter(Boolean).length;

  const exportExcel = () => {
    const rows = filtered.map((p) => ({
      Numéro: p.reference,
      "Payé le": formatShortDate(p.date),
      Professeur: p.professeur,
      Décompte: p.decompteReference,
      Montant: p.montant,
      "Mode de règlement": p.moyen,
      "Payé par": p.payePar,
      Statut: p.annulee ? "Annulé" : "Validé",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paiements professeurs");
    XLSX.writeFile(wb, `paiements-professeurs-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les paiements professeurs" }]}
        title="Les paiements professeurs"
        subtitle={`${paiements.length} paiement(s) enregistré(s)`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAdvancedOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors",
                advancedOpen || advancedActiveCount > 0
                  ? "bg-amber-50 text-amber-700 border border-amber-300"
                  : "border border-border hover:bg-muted",
              )}
              data-testid="btn-recherche-avancee"
            >
              <SlidersHorizontal size={13} /> Recherche avancée{advancedActiveCount > 0 ? ` (${advancedActiveCount})` : ""}
            </button>
            <button
              onClick={exportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="btn-export-excel"
            >
              <Download size={14} /> Export excel
            </button>
            <button
              onClick={() => setLocation("/admin/decomptes-professeurs/new")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="btn-new-paiement-decompte"
            >
              <Plus size={15} /> Nouveau paiement professeur
            </button>
          </div>
        }
      />

      {advancedOpen && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Date de début</label>
            <input type="date" value={dateDebut} onChange={(e) => { setDateDebut(e.target.value); setPage(1); }} className={filterInputClass} data-testid="filter-date-debut" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Date de fin</label>
            <input type="date" value={dateFin} onChange={(e) => { setDateFin(e.target.value); setPage(1); }} className={filterInputClass} data-testid="filter-date-fin" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Montant min</label>
            <input type="number" value={montantMin} onChange={(e) => { setMontantMin(e.target.value); setPage(1); }} className={filterInputClass} placeholder="0" data-testid="filter-montant-min" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Montant max</label>
            <input type="number" value={montantMax} onChange={(e) => { setMontantMax(e.target.value); setPage(1); }} className={filterInputClass} placeholder="Sans limite" data-testid="filter-montant-max" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Mode de règlement</label>
            <select value={moyenFilter} onChange={(e) => { setMoyenFilter(e.target.value); setPage(1); }} className={filterInputClass} data-testid="filter-moyen">
              <option value="">Tous</option>
              {modesPaiement.map((m) => (
                <option key={m.id} value={m.intitule}>{m.intitule}</option>
              ))}
            </select>
          </div>
          {advancedActiveCount > 0 && (
            <div className="sm:col-span-2 lg:col-span-5">
              <button
                onClick={() => { setDateDebut(""); setDateFin(""); setMontantMin(""); setMontantMax(""); setMoyenFilter(""); setPage(1); }}
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
              >
                Réinitialiser la recherche avancée
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full min-w-[950px] text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Numéro</th>
              <th className="text-left px-4 py-3">Payé le</th>
              <th className="text-left px-4 py-3">Professeur</th>
              <th className="text-left px-4 py-3">Décompte</th>
              <th className="text-right px-4 py-3">Montant</th>
              <th className="text-left px-4 py-3">Payé par</th>
              <th className="text-center px-4 py-3">Statut</th>
              <th className="text-right px-4 py-3 w-14" />
            </tr>
            <tr className="border-b border-border bg-card">
              <th className="px-3 py-2">
                <input value={filters.reference} onChange={(e) => patchFilter({ reference: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">
                <input value={filters.professeur} onChange={(e) => patchFilter({ professeur: e.target.value })} className={filterInputClass} placeholder="Nom du professeur…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.decompte} onChange={(e) => patchFilter({ decompte: e.target.value })} className={filterInputClass} placeholder="N° décompte…" />
              </th>
              <th className="px-3 py-2" />
              <th className="px-3 py-2" />
              <th className="px-3 py-2">
                <select value={filters.statut} onChange={(e) => patchFilter({ statut: e.target.value })} className={filterInputClass}>
                  <option value="">Statut</option>
                  <option value="Validé">Validé</option>
                  <option value="Annulé">Annulé</option>
                </select>
              </th>
              <th className="px-3 py-2">
                {(Object.values(filters).some(Boolean)) && (
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
                <td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                  {paiements.length === 0
                    ? "Aucun paiement professeur enregistré pour l'instant."
                    : "Aucun paiement ne correspond aux critères sélectionnés."}
                </td>
              </tr>
            ) : (
              pageRows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => setLocation(`/admin/decomptes-professeurs/${p.id}`)}
                  data-testid={`paiement-decompte-row-${p.id}`}
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{p.reference}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatShortDate(p.date)}</td>
                  <td className="px-4 py-3">{p.professeur}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setLocation(`/admin/decomptes/${p.decompteId}`); }}
                      className="text-primary hover:underline"
                    >
                      {p.decompteReference}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCFA(p.montant)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.payePar}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", p.annulee ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                      {p.annulee ? "Annulé" : "Validé"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/admin/decomptes-professeurs/${p.id}`);
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Voir le détail"
                      data-testid={`paiement-decompte-view-${p.id}`}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))
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
