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
  TrendingUp,
  Receipt,
  Ban,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { useEncaissements } from "@/hooks/useEncaissementStore";
import type { EncaissementRecord } from "@/data/encaissementStore";
import { useModesPaiementFinance } from "@/hooks/useFinanceSettingsStore";
import { formatCFA, cn } from "@/lib/utils";

export function statutEncaissement(r: EncaissementRecord): "Validée" | "Annulée" {
  return r.annulee ? "Annulée" : "Validée";
}

const STATUT_CLS: Record<string, string> = {
  Validée: "bg-emerald-50 text-emerald-700",
  Annulée: "bg-red-50 text-red-700",
};

interface ColFilters {
  reference: string;
  payeur: string;
  encaissePar: string;
  statut: string;
}

const EMPTY_FILTERS: ColFilters = { reference: "", payeur: "", encaissePar: "", statut: "" };

const filterInputClass =
  "w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function EncaissementsPage() {
  const [, setLocation] = useLocation();
  const encaissements = useEncaissements();
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
    return encaissements
      .filter((r) => {
        if (filters.reference && !r.reference.toLowerCase().includes(filters.reference.toLowerCase())) return false;
        if (filters.payeur && !r.payeur.toLowerCase().includes(filters.payeur.toLowerCase())) return false;
        if (filters.encaissePar && !r.encaissePar.toLowerCase().includes(filters.encaissePar.toLowerCase())) return false;
        if (filters.statut && statutEncaissement(r) !== filters.statut) return false;
        if (dateDebut && r.date < dateDebut) return false;
        if (dateFin && r.date > dateFin) return false;
        if (montantMin && r.montant < Number(montantMin)) return false;
        if (montantMax && r.montant > Number(montantMax)) return false;
        if (moyenFilter && r.moyen !== moyenFilter) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [encaissements, filters, dateDebut, dateFin, montantMin, montantMax, moyenFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstRowNum = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRowNum = Math.min(filtered.length, currentPage * pageSize);

  const advancedActiveCount = [dateDebut, dateFin, montantMin, montantMax, moyenFilter].filter(Boolean).length;

  const validees = filtered.filter((r) => !r.annulee);
  const totalEncaisse = validees.reduce((s, r) => s + r.montant, 0);
  const nbAnnulees = filtered.length - validees.length;
  const montantMoyen = validees.length > 0 ? Math.round(totalEncaisse / validees.length) : 0;

  const exportExcel = () => {
    const rows = filtered.map((r) => ({
      Numéro: r.reference,
      "Émis le": formatDateTime(r.date),
      Payeur: r.payeur,
      Montant: r.montant,
      "Encaissé par": r.encaissePar,
      Statut: statutEncaissement(r),
      "Quittance liée": r.quittanceReference,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Encaissements");
    XLSX.writeFile(wb, `encaissements-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les encaissements" }]}
        title="Les opérations"
        subtitle={`${filtered.length} encaissement(s) enregistré(s)`}
        actions={
          <div className="flex gap-2">
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
              onClick={() => setLocation("/admin/paiements/new")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="btn-new-encaissement"
            >
              <Plus size={15} /> Nouvel encaissement
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard icon={TrendingUp} label="Total encaissé" value={formatCFA(totalEncaisse)} accentColor="#10b981" />
        <KPICard icon={Receipt} label="Nb opérations" value={filtered.length} accentColor="#4f46e5" />
        <KPICard icon={Ban} label="Annulées" value={nbAnnulees} accentColor="#ef4444" />
        <KPICard icon={Wallet} label="Montant moyen" value={formatCFA(montantMoyen)} accentColor="#f59e0b" />
      </div>

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
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Mode de paiement</label>
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
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Numéro</th>
              <th className="text-left px-4 py-3">Émis le</th>
              <th className="text-left px-4 py-3">Payeur</th>
              <th className="text-right px-4 py-3">Montant</th>
              <th className="text-left px-4 py-3">Encaissé par</th>
              <th className="text-center px-4 py-3">Statut</th>
              <th className="text-right px-4 py-3 w-14" />
            </tr>
            <tr className="border-b border-border bg-card">
              <th className="px-3 py-2">
                <input value={filters.reference} onChange={(e) => patchFilter({ reference: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">
                <input value={filters.payeur} onChange={(e) => patchFilter({ payeur: e.target.value })} className={filterInputClass} placeholder="Nom, matricule…" />
              </th>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">
                <input value={filters.encaissePar} onChange={(e) => patchFilter({ encaissePar: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <select value={filters.statut} onChange={(e) => patchFilter({ statut: e.target.value })} className={filterInputClass}>
                  <option value="">Statut</option>
                  <option value="Validée">Validée</option>
                  <option value="Annulée">Annulée</option>
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
                <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                  {encaissements.length === 0
                    ? "Aucun encaissement enregistré pour l'instant."
                    : "Aucune opération ne correspond aux critères sélectionnés."}
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => setLocation(`/admin/encaissements/${r.id}`)}
                  data-testid={`enc-row-${r.id}`}
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{r.reference}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(r.date)}</td>
                  <td className="px-4 py-3">{r.payeur}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCFA(r.montant)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.encaissePar}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[statutEncaissement(r)])}>
                      {statutEncaissement(r)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/admin/encaissements/${r.id}`);
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Voir le détail"
                      data-testid={`enc-view-${r.id}`}
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
