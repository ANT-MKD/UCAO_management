import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FILIERES } from "@/data/mockData";

type Filiere = typeof FILIERES[0];

export default function FilieresPage() {
  const [, setLocation] = useLocation();
  const actives = FILIERES.filter((f) => f.statut === "actif").length;

  const columns: Column<Filiere>[] = [
    {
      key: "nom",
      header: "Filière",
      sortable: true,
      render: (r) => (
        <div>
          <div className="font-medium text-foreground text-sm">{r.nom}</div>
        </div>
      ),
    },
    {
      key: "code",
      header: "Code",
      render: (r) => (
        <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary rounded-lg" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {r.code}
        </span>
      ),
    },
    {
      key: "responsable",
      header: "Responsable",
      render: (r) => (
        <div className="flex items-center gap-2">
          <UserAvatar name={r.responsable} size="xs" />
          <span className="text-sm text-foreground">{r.responsable}</span>
        </div>
      ),
    },
    { key: "nbClasses", header: "Classes", sortable: true, render: (r) => <span className="font-medium">{r.nbClasses}</span> },
    { key: "nbEtudiants", header: "Étudiants", sortable: true, render: (r) => <span className="font-medium">{r.nbEtudiants}</span> },
    {
      key: "statut",
      header: "Statut",
      render: (r) => <StatusBadge status={r.statut} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setLocation(`/admin/filieres/${r.id}/edit`); }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
            data-testid={`btn-edit-${r.id}`}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-muted-foreground hover:text-red-500"
            data-testid={`btn-delete-${r.id}`}
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
        breadcrumb={[{ label: "Admin" }, { label: "Filières" }]}
        title="Filières"
        subtitle={`${FILIERES.length} filières configurées pour l'année 2025-2026`}
        actions={
          <button
            onClick={() => setLocation("/admin/filieres/new")}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="btn-new-filiere"
          >
            <Plus size={15} /> Nouvelle Filière
          </button>
        }
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KPICard icon={BookOpen} label="Total Filières" value={FILIERES.length} accentColor="#4f46e5" />
        <KPICard icon={BookOpen} label="Filières Actives" value={actives} accentColor="#10b981" />
        <KPICard icon={BookOpen} label="Filières Inactives" value={FILIERES.length - actives} accentColor="#ef4444" />
      </div>
      <DataTable
        columns={columns}
        data={FILIERES as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher une filière..."
        onRowClick={(r) => setLocation(`/admin/filieres/${(r as unknown as Filiere).id}/edit`)}
      />
    </div>
  );
}
