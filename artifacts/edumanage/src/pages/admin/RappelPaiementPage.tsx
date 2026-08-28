import { useLocation } from "wouter";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { useRappelsPaiement } from "@/hooks/useRappelPaiementStore";
import type { RappelPaiementRecord } from "@/data/rappelPaiementStore";
import { formatShortDate } from "@/lib/utils";

export default function RappelPaiementPage() {
  const [, setLocation] = useLocation();
  const rappels = useRappelsPaiement();

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "details",
      header: "Détails du rappel",
      render: (row) => {
        const r = row as unknown as RappelPaiementRecord;
        return (
          <div>
            <div className="text-sm font-medium text-foreground">{r.reference} — {r.filiereLabel}{r.niveauLabel ? ` — ${r.niveauLabel}` : ""} ({r.annee})</div>
            <div className="text-xs text-muted-foreground">
              {r.nbEtudiants} étudiant(s) · {r.quittanceIds.length} quittance(s) · {r.nbNotificationsEnvoyees} notification(s) envoyée(s) · {formatShortDate(r.date)}
            </div>
          </div>
        );
      },
    },
    { key: "fraisEchusAvant", header: "Échéance", render: (r) => <span className="text-sm">{formatShortDate(r.fraisEchusAvant as string)}</span> },
    {
      key: "nouvelleEcheance",
      header: "Nouvelle échéance",
      render: (r) => (r.nouvelleEcheance ? <span className="text-sm font-medium text-primary">{formatShortDate(r.nouvelleEcheance as string)}</span> : <span className="text-sm text-muted-foreground">—</span>),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Rappel paiement" }]}
        title="Rappel paiement"
        actions={
          <button
            onClick={() => setLocation("/admin/rappel-paiement/new")}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors"
            data-testid="rappel-paiement-nouveau"
          >
            <Plus size={14} /> Nouveau rappel paiement
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={rappels as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher..."
        emptyMessage="Aucune donnée à afficher"
      />
    </div>
  );
}
