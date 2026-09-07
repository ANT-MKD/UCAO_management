import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, SlidersHorizontal, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useFraisEtudiant } from "@/hooks/useFraisEtudiantStore";
import { statutFraisEtudiant, type StatutFraisEtudiant } from "@/data/fraisEtudiantStore";
import { useStudentStore, usePaiements } from "@/hooks/useStudentStore";
import { useTypesFrais } from "@/hooks/useFinanceSettingsStore";
import { formatCFA, formatShortDate, formatDate, cn } from "@/lib/utils";

interface ColFilters {
  etudiant: string;
  typeFrais: string;
  statut: string;
}

const EMPTY_FILTERS: ColFilters = { etudiant: "", typeFrais: "", statut: "" };

const filterInputClass =
  "w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const STATUT_META: Record<StatutFraisEtudiant, { label: string; cls: string }> = {
  en_attente: { label: "Non quittancé", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  quittance: { label: "Quittancé", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  annule: { label: "Annulé", cls: "bg-muted text-muted-foreground" },
};

export default function FraisEtudiantListePage() {
  const fraisEtudiant = useFraisEtudiant();
  const etudiants = useStudentStore();
  const paiements = usePaiements();
  const typesFrais = useTypesFrais();

  const [filters, setFilters] = useState<ColFilters>(EMPTY_FILTERS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [montantMin, setMontantMin] = useState("");
  const [montantMax, setMontantMax] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const patchFilter = (patch: Partial<ColFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const etudiantLabel = (id: string) => {
    const e = etudiants.find((s) => s.id === id);
    return e ? `${e.matricule} - ${e.prenom} ${e.nom}` : "—";
  };

  const typeFraisLabel = (id: string) => typesFrais.find((t) => t.id === id)?.intitule ?? "Frais";

  const rows = useMemo(
    () => fraisEtudiant.map((l) => ({ ligne: l, statut: statutFraisEtudiant(l, paiements) })),
    [fraisEtudiant, paiements],
  );

  const filtered = useMemo(() => {
    return rows
      .filter(({ ligne, statut }) => {
        if (filters.etudiant && !etudiantLabel(ligne.etudiantId).toLowerCase().includes(filters.etudiant.toLowerCase())) return false;
        if (filters.typeFrais && !typeFraisLabel(ligne.typeFraisId).toLowerCase().includes(filters.typeFrais.toLowerCase())) return false;
        if (filters.statut && STATUT_META[statut].label !== filters.statut) return false;
        if (dateDebut && ligne.ajouteLe < dateDebut) return false;
        if (dateFin && ligne.ajouteLe > dateFin) return false;
        if (montantMin && ligne.montant < Number(montantMin)) return false;
        if (montantMax && ligne.montant > Number(montantMax)) return false;
        return true;
      })
      .sort((a, b) => b.ligne.ajouteLe.localeCompare(a.ligne.ajouteLe));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filters, dateDebut, dateFin, montantMin, montantMax, etudiants, typesFrais]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstRowNum = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRowNum = Math.min(filtered.length, currentPage * pageSize);

  const advancedActiveCount = [dateDebut, dateFin, montantMin, montantMax].filter(Boolean).length;

  const exportExcel = () => {
    const data = filtered.map(({ ligne, statut }) => ({
      Date: formatShortDate(ligne.ajouteLe),
      Étudiant: etudiantLabel(ligne.etudiantId),
      Année: ligne.annee,
      "Type frais": typeFraisLabel(ligne.typeFraisId),
      Montant: ligne.montant,
      Statut: STATUT_META[statut].label,
      Motif: ligne.motifAnnulation ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Frais étudiant");
    XLSX.writeFile(wb, `frais-etudiant-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Mise à jour frais étudiant" }, { label: "Les frais étudiant" }]}
        title="Les frais étudiant"
        subtitle={`${fraisEtudiant.length} ligne(s) enregistrée(s) — ajoutées via Ajouter/Ajout en masse`}
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
              data-testid="frais-etudiant-liste-btn-recherche-avancee"
            >
              <SlidersHorizontal size={13} /> Recherche avancée{advancedActiveCount > 0 ? ` (${advancedActiveCount})` : ""}
            </button>
            <button
              onClick={exportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="frais-etudiant-liste-export-excel"
            >
              <Download size={14} /> Export excel
            </button>
          </div>
        }
      />

      {advancedOpen && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Ajouté depuis le</label>
            <input type="date" value={dateDebut} onChange={(e) => { setDateDebut(e.target.value); setPage(1); }} className={filterInputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Ajouté jusqu'au</label>
            <input type="date" value={dateFin} onChange={(e) => { setDateFin(e.target.value); setPage(1); }} className={filterInputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Montant min</label>
            <input type="number" value={montantMin} onChange={(e) => { setMontantMin(e.target.value); setPage(1); }} className={filterInputClass} placeholder="0" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Montant max</label>
            <input type="number" value={montantMax} onChange={(e) => { setMontantMax(e.target.value); setPage(1); }} className={filterInputClass} placeholder="Sans limite" />
          </div>
          {advancedActiveCount > 0 && (
            <div className="sm:col-span-2 lg:col-span-4">
              <button
                onClick={() => { setDateDebut(""); setDateFin(""); setMontantMin(""); setMontantMax(""); setPage(1); }}
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
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Étudiant</th>
              <th className="text-left px-4 py-3">Type frais</th>
              <th className="text-right px-4 py-3">Montant</th>
              <th className="text-center px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Motif</th>
            </tr>
            <tr className="border-b border-border bg-card">
              <th className="px-3 py-2" />
              <th className="px-3 py-2">
                <input value={filters.etudiant} onChange={(e) => patchFilter({ etudiant: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.typeFrais} onChange={(e) => patchFilter({ typeFrais: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">
                <select value={filters.statut} onChange={(e) => patchFilter({ statut: e.target.value })} className={filterInputClass}>
                  <option value="">Statut</option>
                  <option value="Non quittancé">Non quittancé</option>
                  <option value="Quittancé">Quittancé</option>
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
                <td colSpan={6} className="py-16 text-center text-sm text-muted-foreground">
                  {fraisEtudiant.length === 0
                    ? "Aucun frais étudiant enregistré pour l'instant."
                    : "Aucun frais ne correspond aux critères sélectionnés."}
                </td>
              </tr>
            ) : (
              pageRows.map(({ ligne, statut }) => (
                <tr key={ligne.id} className="border-b border-border last:border-0 hover:bg-muted/20" data-testid={`frais-etudiant-liste-row-${ligne.id}`}>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(ligne.ajouteLe)}</td>
                  <td className="px-4 py-3">{etudiantLabel(ligne.etudiantId)}</td>
                  <td className="px-4 py-3">{typeFraisLabel(ligne.typeFraisId)} <span className="text-xs text-muted-foreground">({ligne.annee})</span></td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCFA(ligne.montant)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_META[statut].cls)}>{STATUT_META[statut].label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{ligne.motifAnnulation ?? "—"}</td>
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
