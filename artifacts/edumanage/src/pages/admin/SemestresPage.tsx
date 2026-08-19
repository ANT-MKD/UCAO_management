import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, Calendar, Lock } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SEMESTRES } from "@/data/mockData";

type Semestre = typeof SEMESTRES[0];

export default function SemestresPage() {
  const [, setLocation] = useLocation();
  const actifs = SEMESTRES.filter((s) => s.statut === "actif").length;
  const clos = SEMESTRES.filter((s) => s.statut === "clos").length;

  const columns: Column<Semestre>[] = [
    { key: "nom", header: "Nom", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.nom}</span> },
    { key: "alias", header: "Alias", render: (r) => <span className="font-mono text-xs font-bold px-2.5 py-1 bg-primary/10 text-primary rounded-lg">{r.alias}</span> },
    { key: "niveau", header: "Niveau", render: (r) => <span className="text-sm text-foreground">{r.niveau}</span> },
    { key: "filiere", header: "Filière", render: (r) => <span className="text-xs font-semibold px-2.5 py-1 bg-muted text-foreground rounded-lg">{r.filiere}</span> },
    { key: "periode", header: "Période", render: (r) => <span className="text-xs text-muted-foreground">{r.periode}</span> },
    { key: "statut", header: "Statut", render: (r) => <StatusBadge status={r.statut} /> },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setLocation(`/admin/semestres/${r.id}/edit`); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
          <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Semestres" }]}
        title="Semestres"
        subtitle={`${SEMESTRES.length} semestres configurés`}
        actions={
          <button onClick={() => setLocation("/admin/semestres/new")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Nouveau Semestre
          </button>
        }
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KPICard icon={Calendar} label="Total Semestres" value={SEMESTRES.length} accentColor="#4f46e5" />
        <KPICard icon={Calendar} label="Actifs" value={actifs} accentColor="#10b981" />
        <KPICard icon={Lock} label="Clôturés" value={clos} accentColor="#64748b" />
      </div>
      <DataTable columns={columns} data={SEMESTRES as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher un semestre..." />
    </div>
  );
}
