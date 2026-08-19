import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Plus, Download, TrendingUp, TrendingDown, DollarSign, X } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { TRANSACTIONS } from "@/data/mockData";
import { formatCFA, formatShortDate } from "@/lib/utils";

type Transaction = typeof TRANSACTIONS[0];

const MOYEN_STYLES: Record<string, { bg: string; text: string }> = {
  Wave: { bg: "#eff6ff", text: "#2563eb" },
  OrangeMoney: { bg: "#fff7ed", text: "#ea580c" },
  Virement: { bg: "#eef2ff", text: "#4f46e5" },
  Especes: { bg: "#f0fdf4", text: "#16a34a" },
};

const CATEGORIES = [...new Set(TRANSACTIONS.map((t) => t.categorie))];
const BENEFICIAIRES = [...new Set(TRANSACTIONS.map((t) => t.beneficiaire))];
const MOYENS = [...new Set(TRANSACTIONS.map((t) => t.moyen))];

const CATEGORIE_COLORS: Record<string, string> = {
  Scolarité: "#4f46e5",
  Fournitures: "#f59e0b",
  Entretien: "#8b5cf6",
  Salaires: "#10b981",
  Divers: "#64748b",
};

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5">
        <X size={10} />
      </button>
    </span>
  );
}

export default function TransactionsPage() {
  const [, setLocation] = useLocation();

  // Filters
  const [typeFilter, setTypeFilter] = useState<"" | "Recette" | "Dépense">("");
  const [categorieFilter, setCategorieFilter] = useState("");
  const [moyenFilter, setMoyenFilter] = useState("");
  const [beneficiaireFilter, setBeneficiaireFilter] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [montantMin, setMontantMin] = useState("");
  const [montantMax, setMontantMax] = useState("");

  const filteredData = useMemo(() => {
    return TRANSACTIONS.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (categorieFilter && t.categorie !== categorieFilter) return false;
      if (moyenFilter && t.moyen !== moyenFilter) return false;
      if (beneficiaireFilter && t.beneficiaire !== beneficiaireFilter) return false;
      if (dateDebut && t.date < dateDebut) return false;
      if (dateFin && t.date > dateFin) return false;
      if (montantMin && t.montant < parseInt(montantMin)) return false;
      if (montantMax && t.montant > parseInt(montantMax)) return false;
      return true;
    });
  }, [typeFilter, categorieFilter, moyenFilter, beneficiaireFilter, dateDebut, dateFin, montantMin, montantMax]);

  const recettes = filteredData.filter((t) => t.type === "Recette").reduce((sum, t) => sum + t.montant, 0);
  const depenses = filteredData.filter((t) => t.type === "Dépense").reduce((sum, t) => sum + t.montant, 0);
  const solde = recettes - depenses;
  const marge = recettes > 0 ? Math.round((solde / recettes) * 100) : 0;

  const activeFiltersCount = [typeFilter, categorieFilter, moyenFilter, beneficiaireFilter, dateDebut, dateFin, montantMin, montantMax].filter(Boolean).length;

  const clearFilters = () => {
    setTypeFilter("");
    setCategorieFilter("");
    setMoyenFilter("");
    setBeneficiaireFilter("");
    setDateDebut("");
    setDateFin("");
    setMontantMin("");
    setMontantMax("");
  };

  const columns: Column<Transaction>[] = [
    { key: "date", header: "Date", sortable: true, render: (r) => <span className="text-xs text-muted-foreground">{formatShortDate(r.date)}</span> },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${r.type === "Recette" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
          {r.type}
        </span>
      ),
    },
    {
      key: "categorie",
      header: "Catégorie",
      render: (r) => {
        const color = CATEGORIE_COLORS[r.categorie] ?? "#64748b";
        return <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: `${color}15`, color }}>{r.categorie}</span>;
      },
    },
    { key: "beneficiaire", header: "Bénéficiaire", sortable: true, render: (r) => <span className="text-sm text-foreground">{r.beneficiaire}</span> },
    { key: "libelle", header: "Libellé", render: (r) => <span className="text-sm text-muted-foreground max-w-[200px] truncate block">{r.libelle}</span> },
    {
      key: "montant",
      header: "Montant",
      sortable: true,
      render: (r) => (
        <span className={`font-bold text-sm ${r.type === "Recette" ? "text-emerald-600" : "text-red-500"}`}>
          {r.type === "Recette" ? "+" : "−"}{formatCFA(r.montant)}
        </span>
      ),
    },
    {
      key: "moyen",
      header: "Moyen",
      render: (r) => {
        const s = MOYEN_STYLES[r.moyen] ?? { bg: "#f1f5f9", text: "#64748b" };
        return <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.text }}>{r.moyen}</span>;
      },
    },
    {
      key: "reference",
      header: "Référence",
      render: (r) => <span className="text-[10px] font-mono text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{r.reference}</span>,
    },
  ];

  const filterPanel = (
    <div className="p-4 space-y-4">
      {/* Type quick-select */}
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Type d'opération</label>
        <div className="flex gap-2">
          {(["", "Recette", "Dépense"] as const).map((t) => (
            <button
              key={t || "all"}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-2 text-sm font-semibold rounded-xl border-2 transition-all ${
                typeFilter === t
                  ? t === "Recette"
                    ? "bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : t === "Dépense"
                      ? "bg-red-50 border-red-400 text-red-700 dark:bg-red-950 dark:text-red-300"
                      : "bg-primary/10 border-primary text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              data-testid={`filter-type-${t || "all"}`}
            >
              {t || "Tous"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {/* Catégorie */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Catégorie</label>
          <select
            value={categorieFilter}
            onChange={(e) => setCategorieFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-categorie"
          >
            <option value="">Toutes</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Moyen */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Moyen de paiement</label>
          <select
            value={moyenFilter}
            onChange={(e) => setMoyenFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-moyen"
          >
            <option value="">Tous</option>
            {MOYENS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Bénéficiaire */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Bénéficiaire</label>
          <select
            value={beneficiaireFilter}
            onChange={(e) => setBeneficiaireFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-beneficiaire"
          >
            <option value="">Tous</option>
            {BENEFICIAIRES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Date début */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Date de début</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-date-debut"
          />
        </div>

        {/* Date fin */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Date de fin</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-date-fin"
          />
        </div>

        {/* Montant min */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Montant min (FCFA)</label>
          <input
            type="number"
            value={montantMin}
            onChange={(e) => setMontantMin(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-montant-min"
          />
        </div>

        {/* Montant max */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Montant max (FCFA)</label>
          <input
            type="number"
            value={montantMax}
            onChange={(e) => setMontantMax(e.target.value)}
            placeholder="Sans limite"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-montant-max"
          />
        </div>
      </div>

      {/* Catégorie chips */}
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Catégories rapides</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const color = CATEGORIE_COLORS[c] ?? "#64748b";
            const count = TRANSACTIONS.filter((t) => t.categorie === c).length;
            const isActive = categorieFilter === c;
            return (
              <button
                key={c}
                onClick={() => setCategorieFilter(isActive ? "" : c)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition-all"
                style={isActive ? { background: `${color}15`, color, borderColor: color } : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {c}
                <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
          {typeFilter && <FilterChip label={`Type : ${typeFilter}`} onRemove={() => setTypeFilter("")} />}
          {categorieFilter && <FilterChip label={`Catégorie : ${categorieFilter}`} onRemove={() => setCategorieFilter("")} />}
          {moyenFilter && <FilterChip label={`Moyen : ${moyenFilter}`} onRemove={() => setMoyenFilter("")} />}
          {beneficiaireFilter && <FilterChip label={`Bénéficiaire : ${beneficiaireFilter}`} onRemove={() => setBeneficiaireFilter("")} />}
          {dateDebut && <FilterChip label={`Depuis : ${dateDebut}`} onRemove={() => setDateDebut("")} />}
          {dateFin && <FilterChip label={`Jusqu'au : ${dateFin}`} onRemove={() => setDateFin("")} />}
          {montantMin && <FilterChip label={`Min : ${formatCFA(parseInt(montantMin))}`} onRemove={() => setMontantMin("")} />}
          {montantMax && <FilterChip label={`Max : ${formatCFA(parseInt(montantMax))}`} onRemove={() => setMontantMax("")} />}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Journal des Transactions" }]}
        title="Journal des Transactions"
        subtitle={`${filteredData.length} / ${TRANSACTIONS.length} opérations`}
        actions={
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
              <Download size={13} /> PDF
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors">
              <Download size={13} /> Excel
            </button>
            <button
              onClick={() => setLocation("/admin/transactions/new")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus size={15} /> Nouvelle Transaction
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard icon={TrendingUp} label="Recettes filtrées" value={formatCFA(recettes)} accentColor="#10b981" onClick={() => setTypeFilter("Recette")} />
        <KPICard icon={TrendingDown} label="Dépenses filtrées" value={formatCFA(depenses)} accentColor="#ef4444" onClick={() => setTypeFilter("Dépense")} />
        <KPICard icon={DollarSign} label="Solde net" value={formatCFA(solde)} accentColor={solde >= 0 ? "#4f46e5" : "#ef4444"} />
        <KPICard icon={TrendingUp} label="Marge" value={`${marge}%`} accentColor="#f59e0b" />
      </div>

      <DataTable
        columns={columns}
        data={filteredData as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher dans le journal..."
        filterPanel={filterPanel}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={clearFilters}
        emptyMessage="Aucune transaction ne correspond aux filtres sélectionnés"
        pageSize={15}
      />
    </div>
  );
}
