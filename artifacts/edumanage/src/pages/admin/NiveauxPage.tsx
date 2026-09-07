import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { FILIERES } from "@/data/mockData";
import { useNiveaux } from "@/hooks/useNiveauStore";
import { deleteNiveau, type NiveauRecord } from "@/data/niveauStore";
import { useCycles } from "@/hooks/useAcademicSettingsStore";

const FALLBACK_CYCLE_COLORS: Record<string, string> = { Licence: "#4f46e5", Master: "#8b5cf6", BTS: "#f59e0b", Doctorat: "#10b981" };

export default function NiveauxPage() {
  const [, setLocation] = useLocation();
  const niveaux = useNiveaux();
  const cycles = useCycles();
  const cyclesPresents = [...new Set(niveaux.map((n) => n.cycle))];

  const colorFor = (cycle: string) => {
    const c = cycles.find((c) => c.intitule === cycle);
    return FALLBACK_CYCLE_COLORS[cycle] ?? (c ? "#4f46e5" : "#64748b");
  };

  const columns: Column<NiveauRecord>[] = [
    { key: "nom", header: "Nom", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.nom}</span> },
    {
      key: "alias",
      header: "Alias",
      render: (r) => (
        <span className="font-mono text-xs font-bold px-2.5 py-1 bg-primary/10 text-primary rounded-lg" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {r.alias}
        </span>
      ),
    },
    {
      key: "cycle",
      header: "Cycle LMD",
      render: (r) => (
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: `${colorFor(r.cycle)}15`, color: colorFor(r.cycle) }}>
          {r.cycle}
        </span>
      ),
    },
    {
      key: "filiereId",
      header: "Filière",
      render: (r) => {
        const f = FILIERES.find((f) => f.id === r.filiereId);
        return <span className="text-xs font-semibold px-2.5 py-1 bg-muted text-foreground rounded-lg">{f?.code ?? r.filiere}</span>;
      },
    },
    {
      key: "creditsRequisEntree",
      header: "Crédits requis",
      render: (r) => <span className="text-xs text-muted-foreground">{r.creditsRequisEntree ?? "—"}</span>,
    },
    {
      key: "passageConditionnelAutorise",
      header: "AJAC",
      render: (r) =>
        r.passageConditionnelAutorise ? (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">≥ {r.creditDetteMin ?? 0} crédits</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setLocation(`/admin/niveaux/${r.id}/edit`); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Supprimer le niveau ${r.nom} (${r.alias}) ?`)) deleteNiveau(r.id);
            }}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Niveaux" }]}
        title="Niveaux d'études"
        subtitle={`${niveaux.length} niveaux configurés dans ${FILIERES.length} filières`}
        actions={
          <button onClick={() => setLocation("/admin/niveaux/new")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Nouveau Niveau
          </button>
        }
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KPICard icon={Layers} label="Total Niveaux" value={niveaux.length} accentColor="#4f46e5" />
        <KPICard icon={Layers} label="Cycles" value={cyclesPresents.length} accentColor="#10b981" />
        <KPICard icon={Layers} label="Filières couvertes" value={FILIERES.length} accentColor="#f59e0b" />
      </div>
      <DataTable columns={columns as unknown as Column<Record<string, unknown>>[]} data={niveaux as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher un niveau..." />
    </div>
  );
}
