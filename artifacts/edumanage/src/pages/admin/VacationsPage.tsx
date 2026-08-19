import { useLocation } from "wouter";
import { Plus, Pencil, Check, DollarSign, Users, Clock } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { VACATIONS } from "@/data/mockData";
import { formatCFA, cn } from "@/lib/utils";

type Vacation = typeof VACATIONS[0];

const STATUT_STYLES: Record<string, { label: string; class: string }> = {
  paye: { label: "Payé", class: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  valide: { label: "Validé", class: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  brouillon: { label: "Brouillon", class: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
};

export default function VacationsPage() {
  const [, setLocation] = useLocation();
  const totalMontant = VACATIONS.reduce((sum, v) => sum + v.montantTotal, 0);
  const totalHeures = VACATIONS.reduce((sum, v) => sum + v.heuresCm + v.heuresTd, 0);
  const profs = [...new Set(VACATIONS.map((v) => v.enseignantId))].length;

  const columns: Column<Vacation>[] = [
    { key: "mois", header: "Mois", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.mois}</span> },
    {
      key: "enseignant",
      header: "Enseignant",
      render: (r) => (
        <div className="flex items-center gap-2">
          <UserAvatar name={r.enseignant} size="xs" />
          <span className="text-sm font-medium text-foreground">{r.enseignant}</span>
        </div>
      ),
    },
    {
      key: "modules",
      header: "Modules",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.modules.slice(0, 2).map((m) => <span key={m} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-foreground">{m}</span>)}
          {r.modules.length > 2 && <span className="text-[10px] text-muted-foreground">+{r.modules.length - 2}</span>}
        </div>
      ),
    },
    {
      key: "heures",
      header: "Heures",
      render: (r) => (
        <div className="text-xs space-y-0.5">
          <div className="text-muted-foreground">CM: <span className="font-medium text-foreground">{r.heuresCm}h</span></div>
          <div className="text-muted-foreground">TD: <span className="font-medium text-foreground">{r.heuresTd}h</span></div>
        </div>
      ),
    },
    { key: "montantTotal", header: "Montant", sortable: true, render: (r) => <span className="font-bold text-primary">{formatCFA(r.montantTotal)}</span> },
    {
      key: "statut",
      header: "Statut",
      render: (r) => {
        const s = STATUT_STYLES[r.statut] ?? { label: r.statut, class: "bg-muted text-muted-foreground" };
        return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", s.class)}>{s.label}</span>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setLocation(`/admin/vacations/${r.id}/edit`); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
          {r.statut === "valide" && (
            <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 text-muted-foreground hover:text-emerald-600 transition-colors" title="Marquer payé"><Check size={14} /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Vacations Enseignants" }]}
        title="Vacations Enseignants"
        subtitle="Suivi des heures et rémunérations des vacataires"
        actions={
          <button onClick={() => setLocation("/admin/vacations/new")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Nouvelle Vacation
          </button>
        }
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KPICard icon={DollarSign} label="Montant total" value={formatCFA(totalMontant)} accentColor="#4f46e5" />
        <KPICard icon={Clock} label="Total heures" value={`${totalHeures}h`} accentColor="#10b981" />
        <KPICard icon={Users} label="Enseignants actifs" value={profs} accentColor="#f59e0b" />
      </div>
      <DataTable columns={columns} data={VACATIONS as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher une vacation..." />
    </div>
  );
}
