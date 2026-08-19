import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, DollarSign, Calendar } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { FRAIS_CONFIG } from "@/data/mockData";
import { formatCFA } from "@/lib/utils";

type FraisConfig = typeof FRAIS_CONFIG[0];

const MOIS_SCOLARITE = ["Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin"];

export default function FraisPage() {
  const [, setLocation] = useLocation();
  const totalAnnuel = FRAIS_CONFIG.reduce((sum, f) => sum + f.inscription + f.scolariteAnnuelle + f.fraisDivers, 0);
  const avgMensualite = Math.round(FRAIS_CONFIG.reduce((sum, f) => sum + f.scolariteAnnuelle, 0) / FRAIS_CONFIG.length / 9);

  const columns: Column<FraisConfig>[] = [
    { key: "filiere", header: "Filière", sortable: true, render: (r) => <span className="font-semibold text-foreground">{r.filiere}</span> },
    { key: "niveau", header: "Niveau", render: (r) => <span className="text-sm text-foreground">{r.niveau}</span> },
    { key: "annee", header: "Année", render: (r) => <span className="text-xs text-muted-foreground">{r.annee}</span> },
    { key: "inscription", header: "Inscription", sortable: true, render: (r) => <span className="font-medium text-foreground">{formatCFA(r.inscription)}</span> },
    {
      key: "scolariteAnnuelle",
      header: "Scolarité (9 mois)",
      render: (r) => (
        <div>
          <div className="font-medium text-foreground">{formatCFA(r.scolariteAnnuelle)}</div>
          <div className="text-[10px] text-muted-foreground">{formatCFA(Math.round(r.scolariteAnnuelle / 9))}/mois</div>
        </div>
      ),
    },
    { key: "fraisDivers", header: "Frais divers", render: (r) => <span className="text-sm text-muted-foreground">{formatCFA(r.fraisDivers)}</span> },
    { key: "total", header: "Total annuel", render: (r) => <span className="font-bold text-primary">{formatCFA(r.inscription + r.scolariteAnnuelle + r.fraisDivers)}</span> },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setLocation(`/admin/frais/${r.id}/edit`); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
          <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Configuration des Frais" }]}
        title="Configuration des Frais"
        subtitle="Grilles tarifaires avec scolarité échelonnée sur 9 mensualités (Octobre → Juin)"
        actions={
          <button onClick={() => setLocation("/admin/frais/new")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Nouvelle Grille
          </button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KPICard icon={DollarSign} label="Grilles configurées" value={FRAIS_CONFIG.length} accentColor="#4f46e5" />
        <KPICard icon={Calendar} label="Mensualité moyenne" value={formatCFA(avgMensualite)} accentColor="#10b981" />
        <KPICard icon={DollarSign} label="Volume annuel total" value={formatCFA(totalAnnuel)} accentColor="#f59e0b" />
      </div>

      {/* Échéancier visuel */}
      <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={15} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Calendrier des mensualités — Année 2025-2026</h3>
          <span className="ml-auto text-xs text-muted-foreground">9 échéances · Oct 2025 → Juin 2026</span>
        </div>
        <div className="grid grid-cols-9 gap-2">
          {MOIS_SCOLARITE.map((mois, i) => (
            <div key={mois} className="text-center p-2.5 rounded-xl bg-primary/5 border border-primary/15">
              <div className="text-[10px] font-semibold text-primary mb-1">{mois}</div>
              <div className="text-[10px] text-muted-foreground">M{i + 1}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tableau des grilles */}
      <DataTable columns={columns} data={FRAIS_CONFIG as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher une filière..." />

      {/* Détail par filière */}
      <div className="mt-6 grid grid-cols-1 gap-4">
        {FRAIS_CONFIG.map((f) => {
          const mensualite = Math.round(f.scolariteAnnuelle / 9);
          const total = f.inscription + f.scolariteAnnuelle + f.fraisDivers;
          return (
            <div key={f.id} className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{f.filiere} — {f.niveau}</h4>
                  <p className="text-xs text-muted-foreground">Année {f.annee}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total annuel</p>
                  <p className="font-bold text-primary">{formatCFA(total)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-muted/40 rounded-xl text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Inscription</p>
                  <p className="font-bold text-sm text-foreground">{formatCFA(f.inscription)}</p>
                  <p className="text-[10px] text-muted-foreground">Versé à l'inscription</p>
                </div>
                <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl text-center">
                  <p className="text-[10px] text-primary mb-1 font-medium">Mensualité</p>
                  <p className="font-bold text-sm text-primary">{formatCFA(mensualite)}</p>
                  <p className="text-[10px] text-muted-foreground">× 9 mois</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Frais divers</p>
                  <p className="font-bold text-sm text-foreground">{formatCFA(f.fraisDivers)}</p>
                  <p className="text-[10px] text-muted-foreground">Bibliothèque, etc.</p>
                </div>
              </div>
              <div className="grid grid-cols-9 gap-1">
                {MOIS_SCOLARITE.map((mois, i) => (
                  <div key={mois} className="text-center py-2 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[9px] text-muted-foreground">{mois}</p>
                    <p className="text-[9px] font-bold text-foreground">{Math.round(mensualite / 1000)}k</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
