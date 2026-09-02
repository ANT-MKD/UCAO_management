import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Pencil, Check, DollarSign, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FormModal } from "@/components/admin/FormModal";
import { useVacations } from "@/hooks/useVacationStore";
import { markVacationPaid, type VacationRecord } from "@/data/vacationStore";
import { useModesPaiementFinance } from "@/hooks/useFinanceSettingsStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, cn } from "@/lib/utils";

type Vacation = VacationRecord;

const STATUT_STYLES: Record<string, { label: string; class: string }> = {
  paye: { label: "Payé", class: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  valide: { label: "Validé", class: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  brouillon: { label: "Brouillon", class: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
};

export default function VacationsPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const vacations = useVacations();
  const modesPaiement = useModesPaiementFinance();
  const [paiementCible, setPaiementCible] = useState<Vacation | null>(null);
  const [moyenChoisi, setMoyenChoisi] = useState("");

  const totalMontant = vacations.reduce((sum, v) => sum + v.montantTotal, 0);
  const totalHeures = vacations.reduce((sum, v) => sum + v.heuresCm + v.heuresTd, 0);
  const profs = [...new Set(vacations.map((v) => v.enseignantId))].length;

  const openPaiement = (v: Vacation) => {
    setPaiementCible(v);
    setMoyenChoisi(modesPaiement[0]?.intitule ?? "");
  };

  const confirmerPaiement = () => {
    if (!paiementCible || !moyenChoisi || !currentUser) return;
    markVacationPaid(paiementCible.id, moyenChoisi, currentUser.id);
    toast.success(`Vacation de ${paiementCible.enseignant} marquée payée.`);
    setPaiementCible(null);
  };

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
            <button onClick={(e) => { e.stopPropagation(); openPaiement(r); }} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 text-muted-foreground hover:text-emerald-600 transition-colors" title="Marquer payé" data-testid={`vacation-marquer-paye-${r.id}`}><Check size={14} /></button>
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
      <DataTable columns={columns as unknown as Column<Record<string, unknown>>[]} data={vacations as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher une vacation..." />

      <FormModal open={!!paiementCible} onClose={() => setPaiementCible(null)} title="Marquer la vacation comme payée" size="sm">
        {paiementCible && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {paiementCible.enseignant} — {paiementCible.mois} — <span className="font-bold text-primary">{formatCFA(paiementCible.montantTotal)}</span>
            </p>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyen de paiement</label>
              <select value={moyenChoisi} onChange={(e) => setMoyenChoisi(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="vacation-paiement-moyen">
                {modesPaiement.map((m) => <option key={m.id} value={m.intitule}>{m.intitule}</option>)}
              </select>
            </div>
            <button onClick={confirmerPaiement} disabled={!moyenChoisi} className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors" data-testid="vacation-confirmer-paiement">
              Confirmer le paiement
            </button>
          </div>
        )}
      </FormModal>
    </div>
  );
}
