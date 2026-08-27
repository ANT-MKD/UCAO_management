import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Plus, Eye, Download, TrendingUp, AlertTriangle, CreditCard, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { usePaiements, useStudentStore } from "@/hooks/useStudentStore";
import { relancerQuittances } from "@/data/studentStore";
import type { PaiementRecord } from "@/data/studentStore";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

type Statut = "Payé" | "Acompte" | "Annulé" | "Impayé";

const STATUT_CLS: Record<Statut, string> = {
  Payé: "bg-emerald-50 text-emerald-700",
  Acompte: "bg-amber-50 text-amber-700",
  Annulé: "bg-red-50 text-red-700",
  Impayé: "bg-slate-100 text-slate-600",
};

const PAGE_SIZE = 15;
const TODAY = new Date().toISOString().slice(0, 10);

export function montantQuittance(p: PaiementRecord): number {
  return p.lignes && p.lignes.length > 0 ? p.lignes.reduce((s, l) => s + l.montant, 0) : p.montant;
}

export function statutQuittance(p: PaiementRecord): Statut {
  if (p.statut === "annule") return "Annulé";
  if (p.montant === 0) return "Impayé";
  return p.montant >= montantQuittance(p) ? "Payé" : "Acompte";
}

function isEnRetard(p: PaiementRecord): boolean {
  if (p.statut === "annule" || !p.dateLimite) return false;
  if (p.montant >= montantQuittance(p)) return false;
  return p.dateLimite < TODAY;
}

function joursRetard(p: PaiementRecord): number {
  if (!p.dateLimite) return 0;
  return Math.floor((Date.now() - new Date(p.dateLimite).getTime()) / 86400000);
}

interface ColFilters {
  numero: string;
  emise: string;
  limite: string;
  adresse: string;
  montantQuittance: string;
  montantPaye: string;
  statut: string;
}

const EMPTY_FILTERS: ColFilters = {
  numero: "",
  emise: "",
  limite: "",
  adresse: "",
  montantQuittance: "",
  montantPaye: "",
  statut: "",
};

const filterInputClass =
  "w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function PaiementsPage() {
  const [, setLocation] = useLocation();
  const paiements = usePaiements();
  const etudiants = useStudentStore();
  const [filters, setFilters] = useState<ColFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const rows = useMemo(
    () =>
      paiements.map((p) => {
        const etu = etudiants.find((e) => e.id === p.etudiantId);
        return {
          record: p,
          matricule: etu?.matricule ?? "",
          montantQuittance: montantQuittance(p),
          montantPaye: p.montant,
          statut: statutQuittance(p),
          enRetard: isEnRetard(p),
        };
      }),
    [paiements, etudiants],
  );

  const filtered = useMemo(() => {
    const f = filters;
    return rows
      .filter((r) => {
        if (f.numero && !r.record.numeroRecu.toLowerCase().includes(f.numero.toLowerCase())) return false;
        if (f.emise && !formatShortDate(r.record.date).includes(f.emise)) return false;
        if (f.limite) {
          const limite = r.record.dateLimite ? formatShortDate(r.record.dateLimite) : "";
          if (!limite.includes(f.limite)) return false;
        }
        if (f.adresse) {
          const haystack = `${r.matricule} ${r.record.etudiant}`.toLowerCase();
          if (!haystack.includes(f.adresse.toLowerCase())) return false;
        }
        if (f.montantQuittance && !String(r.montantQuittance).includes(f.montantQuittance)) return false;
        if (f.montantPaye && !String(r.montantPaye).includes(f.montantPaye)) return false;
        if (f.statut && !r.statut.toLowerCase().includes(f.statut.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => b.record.date.localeCompare(a.record.date));
  }, [rows, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalQuittance = filtered.reduce((sum, r) => sum + r.montantQuittance, 0);
  const nbAcompte = filtered.filter((r) => r.statut === "Acompte").length;
  const impayés = etudiants.filter((e) => e.soldeDu > 0).length;
  const tauxRecouvrement =
    etudiants.length > 0
      ? Math.round((etudiants.filter((e) => e.soldeDu === 0).length / etudiants.length) * 100)
      : 0;

  const enRetardRows = rows.filter((r) => r.enRetard);
  const aging = {
    j030: enRetardRows.filter((r) => joursRetard(r.record) <= 30).length,
    j3060: enRetardRows.filter((r) => joursRetard(r.record) > 30 && joursRetard(r.record) <= 60).length,
    j60plus: enRetardRows.filter((r) => joursRetard(r.record) > 60).length,
  };

  const patchFilter = (patch: Partial<ColFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setSelectedIds([]);
  };

  const exportRows = (list: typeof filtered) =>
    list.map((r) => ({
      "N° quittance": r.record.numeroRecu,
      "Émise le": formatShortDate(r.record.date),
      "Date Limite": r.record.dateLimite ? formatShortDate(r.record.dateLimite) : "",
      "Adressée à": `${r.matricule} - ${r.record.etudiant}`,
      "Mt quittancé": r.montantQuittance,
      "Mt payé": r.montantPaye,
      Statut: r.statut,
    }));

  const exportExcel = (list: typeof filtered = filtered, suffix = "") => {
    const ws = XLSX.utils.json_to_sheet(exportRows(list));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quittances");
    XLSX.writeFile(wb, `quittances${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const toggleSelectAllPage = () => {
    const pageIds = pageRows.map((r) => r.record.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) =>
      allSelected ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])],
    );
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleRelancer = () => {
    const count = relancerQuittances(selectedIds);
    toast.success(count > 0 ? `${count} relance(s) envoyée(s) au portail étudiant` : "Aucune quittance sélectionnée n'est en attente de règlement");
    setSelectedIds([]);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les quittances" }]}
        title="Les quittances"
        subtitle={`${paiements.length} quittances enregistrées cette année`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => exportExcel()}
              className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="btn-export-excel"
            >
              <Download size={14} /> Export excel
            </button>
            <button
              onClick={() => setLocation("/admin/paiements/new")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="btn-new-paiement"
            >
              <Plus size={15} /> Nouvelle quittance
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard icon={TrendingUp} label="Total quittancé" value={formatCFA(totalQuittance)} accentColor="#10b981" />
        <KPICard icon={CreditCard} label="Nb quittances" value={filtered.length} accentColor="#4f46e5" />
        <KPICard icon={AlertTriangle} label="Acomptes en cours" value={nbAcompte} accentColor="#f59e0b" />
        <KPICard
          icon={TrendingUp}
          label="Taux recouvrement"
          value={`${tauxRecouvrement}%`}
          trend={`${impayés} étudiant(s) avec solde dû`}
          trendDirection={impayés > 0 ? "down" : "up"}
          accentColor="#ef4444"
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Recouvrement — quittances en retard</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 0–30 j : <strong>{aging.j030}</strong></span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> 31–60 j : <strong>{aging.j3060}</strong></span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600" /> 60+ j : <strong>{aging.j60plus}</strong></span>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 mb-3">
          <span className="text-sm font-medium">{selectedIds.length} quittance(s) sélectionnée(s)</span>
          <div className="flex gap-2">
            <button
              onClick={() => exportExcel(filtered.filter((r) => selectedIds.includes(r.record.id)), "-selection")}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors bg-card"
            >
              <Download size={13} /> Exporter la sélection
            </button>
            <button
              onClick={handleRelancer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
              data-testid="btn-relancer-selection"
            >
              <Bell size={13} /> Relancer
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full min-w-[1120px] text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={pageRows.length > 0 && pageRows.every((r) => selectedIds.includes(r.record.id))}
                  onChange={toggleSelectAllPage}
                />
              </th>
              <th className="text-left px-4 py-3">N° quittance</th>
              <th className="text-left px-4 py-3">Émise le</th>
              <th className="text-left px-4 py-3">Date Limite</th>
              <th className="text-left px-4 py-3">Adressée à</th>
              <th className="text-right px-4 py-3">Mt quittancé</th>
              <th className="text-right px-4 py-3">Mt payé</th>
              <th className="text-center px-4 py-3">Statut</th>
              <th className="text-right px-4 py-3 w-14" />
            </tr>
            <tr className="border-b border-border bg-card">
              <th className="px-3 py-2" />
              <th className="px-3 py-2">
                <input value={filters.numero} onChange={(e) => patchFilter({ numero: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.emise} onChange={(e) => patchFilter({ emise: e.target.value })} className={filterInputClass} placeholder="jj/mm/aaaa" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.limite} onChange={(e) => patchFilter({ limite: e.target.value })} className={filterInputClass} placeholder="jj/mm/aaaa" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.adresse} onChange={(e) => patchFilter({ adresse: e.target.value })} className={filterInputClass} placeholder="Nom, matricule…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.montantQuittance} onChange={(e) => patchFilter({ montantQuittance: e.target.value })} className={filterInputClass} placeholder="Montant" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.montantPaye} onChange={(e) => patchFilter({ montantPaye: e.target.value })} className={filterInputClass} placeholder="Montant" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.statut} onChange={(e) => patchFilter({ statut: e.target.value })} className={filterInputClass} placeholder="Statut" />
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
                <td colSpan={9} className="py-16 text-center text-sm text-muted-foreground">
                  Aucune quittance ne correspond aux critères sélectionnés.
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr
                  key={r.record.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => setLocation(`/admin/paiements/${r.record.id}`)}
                  data-testid={`quittance-row-${r.record.id}`}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded" checked={selectedIds.includes(r.record.id)} onChange={() => toggleSelectRow(r.record.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{r.record.numeroRecu}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatShortDate(r.record.date)}</td>
                  <td className={cn("px-4 py-3 whitespace-nowrap", r.enRetard ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                    {r.record.dateLimite ? formatShortDate(r.record.dateLimite) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">{r.matricule}</span>{" "}
                    <span className="font-medium">{r.record.etudiant}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCFA(r.montantQuittance)}</td>
                  <td className="px-4 py-3 text-right">{formatCFA(r.montantPaye)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[r.statut])}>{r.statut}</span>
                    {r.enRetard && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">En retard</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/admin/paiements/${r.record.id}`);
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Voir la quittance"
                      data-testid={`quittance-view-${r.record.id}`}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Page {currentPage} / {totalPages} — {filtered.length} quittance(s)
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
