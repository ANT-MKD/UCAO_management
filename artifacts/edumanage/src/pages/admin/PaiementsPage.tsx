import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Plus, Eye, Download, TrendingUp, AlertTriangle, CreditCard, X } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { usePaiements, useStudentStore } from "@/hooks/useStudentStore";
import type { PaiementRecord } from "@/data/studentStore";
import { formatCFA, formatShortDate } from "@/lib/utils";

type Paiement = PaiementRecord;

const MOYEN_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  Wave: { label: "Wave", bg: "#eff6ff", text: "#2563eb" },
  OrangeMoney: { label: "Orange Money", bg: "#fff7ed", text: "#ea580c" },
  Especes: { label: "Espèces", bg: "#f0fdf4", text: "#16a34a" },
  Virement: { label: "Virement", bg: "#eef2ff", text: "#4f46e5" },
  Cheque: { label: "Chèque", bg: "#f8fafc", text: "#64748b" },
};

const MOYENS = Object.keys(MOYEN_STYLES);

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

export default function PaiementsPage() {
  const [, setLocation] = useLocation();
  const paiements = usePaiements();
  const etudiants = useStudentStore();
  const RUBRIQUES = useMemo(() => [...new Set(paiements.map((p) => p.rubrique))], [paiements]);

  // Filters
  const [moyenFilter, setMoyenFilter] = useState("");
  const [rubriqueFilter, setRubriqueFilter] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [montantMin, setMontantMin] = useState("");
  const [montantMax, setMontantMax] = useState("");
  const [soldeDuOnly, setSoldeDuOnly] = useState(false);

  const filteredData = useMemo(() => {
    return paiements.filter((p) => {
      if (moyenFilter && p.moyen !== moyenFilter) return false;
      if (rubriqueFilter && p.rubrique !== rubriqueFilter) return false;
      if (dateDebut && p.date < dateDebut) return false;
      if (dateFin && p.date > dateFin) return false;
      if (montantMin && p.montant < parseInt(montantMin)) return false;
      if (montantMax && p.montant > parseInt(montantMax)) return false;
      if (soldeDuOnly && p.soldeRestant === 0) return false;
      return true;
    });
  }, [paiements, moyenFilter, rubriqueFilter, dateDebut, dateFin, montantMin, montantMax, soldeDuOnly]);

  const totalMois = filteredData.reduce((sum, p) => sum + p.montant, 0);
  const impayés = etudiants.filter((e) => e.soldeDu > 0).length;
  const tauxRecouvrement = etudiants.length > 0
    ? Math.round((etudiants.filter((e) => e.soldeDu === 0).length / etudiants.length) * 100)
    : 0;

  const activeFiltersCount = [moyenFilter, rubriqueFilter, dateDebut, dateFin, montantMin, montantMax, soldeDuOnly].filter(Boolean).length;

  const clearFilters = () => {
    setMoyenFilter("");
    setRubriqueFilter("");
    setDateDebut("");
    setDateFin("");
    setMontantMin("");
    setMontantMax("");
    setSoldeDuOnly(false);
  };

  const columns: Column<Paiement>[] = [
    { key: "date", header: "Date", sortable: true, render: (r) => <span className="text-xs text-muted-foreground">{formatShortDate(r.date)}</span> },
    {
      key: "etudiant",
      header: "Étudiant",
      render: (r) => (
        <div className="flex items-center gap-2">
          <UserAvatar name={r.etudiant} size="xs" />
          <div>
            <div className="text-sm font-medium text-foreground">{r.etudiant}</div>
            <div className="text-[10px] text-muted-foreground">{r.classe}</div>
          </div>
        </div>
      ),
    },
    { key: "rubrique", header: "Rubrique", sortable: true, render: (r) => (
      <div>
        <span className="text-sm text-foreground">{r.rubrique}</span>
        {r.lignes && r.lignes.length > 1 && (
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {r.lignes.map((l) => l.label).join(" · ")}
          </div>
        )}
      </div>
    ) },
    {
      key: "montant",
      header: "Montant",
      sortable: true,
      render: (r) => <span className="font-bold text-foreground">{formatCFA(r.montant)}</span>,
    },
    {
      key: "moyen",
      header: "Moyen",
      render: (r) => {
        const s = MOYEN_STYLES[r.moyen] ?? { label: r.moyen, bg: "#f1f5f9", text: "#64748b" };
        return (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.text }}>
            {s.label}
          </span>
        );
      },
    },
    {
      key: "reference",
      header: "Référence",
      render: (r) => <span className="text-xs font-mono text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{r.reference || "—"}</span>,
    },
    {
      key: "soldeRestant",
      header: "Solde restant",
      sortable: true,
      render: (r) => (
        <span className={r.soldeRestant > 0 ? "text-red-500 font-semibold text-sm" : "text-emerald-600 text-sm"}>
          {r.soldeRestant > 0 ? formatCFA(r.soldeRestant) : "Soldé ✓"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: () => (
        <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
          <Eye size={14} />
        </button>
      ),
    },
  ];

  const filterPanel = (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {/* Moyen de paiement */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Moyen de paiement</label>
          <select
            value={moyenFilter}
            onChange={(e) => setMoyenFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-moyen"
          >
            <option value="">Tous les moyens</option>
            {MOYENS.map((m) => <option key={m} value={m}>{MOYEN_STYLES[m]?.label ?? m}</option>)}
          </select>
        </div>

        {/* Rubrique */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Rubrique</label>
          <select
            value={rubriqueFilter}
            onChange={(e) => setRubriqueFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-rubrique"
          >
            <option value="">Toutes les rubriques</option>
            {RUBRIQUES.map((r) => <option key={r} value={r}>{r}</option>)}
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

        {/* Solde restant */}
        <div className="flex flex-col justify-between">
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Impayés</label>
          <button
            onClick={() => setSoldeDuOnly((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg font-medium transition-all ${
              soldeDuOnly
                ? "bg-red-50 border-red-300 text-red-600 dark:bg-red-950 dark:border-red-700 dark:text-red-300"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
            data-testid="filter-solde-du"
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${soldeDuOnly ? "bg-red-500 border-red-500" : "border-border"}`}>
              {soldeDuOnly && <span className="text-white text-[10px]">✓</span>}
            </span>
            Avec solde restant
          </button>
        </div>
      </div>

      {/* Moyen de paiement quick-select chips */}
      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sélection rapide du moyen</label>
        <div className="flex flex-wrap gap-2">
          {MOYENS.map((m) => {
            const s = MOYEN_STYLES[m];
            const count = paiements.filter((p) => p.moyen === m).length;
            const isActive = moyenFilter === m;
            return (
              <button
                key={m}
                onClick={() => setMoyenFilter(isActive ? "" : m)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition-all"
                style={isActive ? { background: s.bg, color: s.text, borderColor: s.text } : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: s.text }} />
                {s.label}
                <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
          {moyenFilter && <FilterChip label={`Moyen : ${MOYEN_STYLES[moyenFilter]?.label}`} onRemove={() => setMoyenFilter("")} />}
          {rubriqueFilter && <FilterChip label={`Rubrique : ${rubriqueFilter}`} onRemove={() => setRubriqueFilter("")} />}
          {dateDebut && <FilterChip label={`Depuis : ${dateDebut}`} onRemove={() => setDateDebut("")} />}
          {dateFin && <FilterChip label={`Jusqu'au : ${dateFin}`} onRemove={() => setDateFin("")} />}
          {montantMin && <FilterChip label={`Min : ${formatCFA(parseInt(montantMin))}`} onRemove={() => setMontantMin("")} />}
          {montantMax && <FilterChip label={`Max : ${formatCFA(parseInt(montantMax))}`} onRemove={() => setMontantMax("")} />}
          {soldeDuOnly && <FilterChip label="Solde restant uniquement" onRemove={() => setSoldeDuOnly(false)} />}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Paiements Étudiants" }]}
        title="Paiements Étudiants"
        subtitle={`${paiements.length} paiements enregistrés cette année`}
        actions={
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground">
              <Download size={13} /> Exporter
            </button>
            <button
              onClick={() => setLocation("/admin/paiements/new")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="btn-new-paiement"
            >
              <Plus size={15} /> Enregistrer Paiement
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard icon={TrendingUp} label="Total filtré" value={formatCFA(totalMois)} accentColor="#10b981" />
        <KPICard icon={CreditCard} label="Nb paiements" value={filteredData.length} accentColor="#4f46e5" />
        <KPICard icon={AlertTriangle} label="Étudiants impayés" value={impayés} accentColor="#ef4444" onClick={() => setSoldeDuOnly(true)} />
        <KPICard icon={TrendingUp} label="Taux recouvrement" value={`${tauxRecouvrement}%`} trend="+6% vs mois dernier" trendDirection="up" accentColor="#f59e0b" />
      </div>

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={filteredData as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher un étudiant, référence, rubrique..."
        filterPanel={filterPanel}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={clearFilters}
        emptyMessage="Aucun paiement ne correspond aux filtres sélectionnés"
        pageSize={10}
      />
    </div>
  );
}
