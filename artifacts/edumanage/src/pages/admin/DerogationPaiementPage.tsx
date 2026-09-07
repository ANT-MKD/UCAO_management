import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { Plus, Eye, Download, Clock } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useDerogationsPaiement } from "@/hooks/useDerogationPaiementStore";
import { statutDerogation, PORTEE_LABELS, type DerogationPaiementRecord } from "@/data/derogationPaiementStore";
import { formatCFA, formatShortDate } from "@/lib/utils";

function joursAvantExpiration(dateFin: string): number {
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(dateFin).getTime() - new Date(today).getTime()) / 86400000);
}

export default function DerogationPaiementPage() {
  const [, setLocation] = useLocation();
  const derogations = useDerogationsPaiement();

  const exportExcel = () => {
    const rows = derogations.map((r) => ({
      Référence: r.reference,
      Étudiant: r.etudiantLabel,
      Portée: PORTEE_LABELS[r.portee],
      "Solde constaté": r.soldeDuConstate,
      Motif: r.motif,
      "Date d'octroi": formatShortDate(r.date),
      "Autorisée par": r.personnelLabel,
      "Valable du": formatShortDate(r.dateDebut),
      "Valable au": formatShortDate(r.dateFin),
      Statut: statutDerogation(r),
      "Motif de révocation": r.motifRevocation ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dérogations");
    XLSX.writeFile(wb, `derogations-paiement-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "details",
      header: "Dérogation",
      render: (row) => {
        const r = row as unknown as DerogationPaiementRecord;
        return (
          <div>
            <div className="text-sm font-medium text-foreground">{r.reference} — {r.etudiantLabel}</div>
            <div className="text-xs text-muted-foreground">{PORTEE_LABELS[r.portee]} · Solde constaté {formatCFA(r.soldeDuConstate)} · {formatShortDate(r.date)}</div>
          </div>
        );
      },
    },
    { key: "motif", header: "Motif", render: (r) => <span className="text-sm text-muted-foreground line-clamp-1">{r.motif as string}</span> },
    {
      key: "validite",
      header: "Validité",
      render: (row) => {
        const r = row as unknown as DerogationPaiementRecord;
        return <span className="text-sm">{formatShortDate(r.dateDebut)} → {formatShortDate(r.dateFin)}</span>;
      },
    },
    { key: "personnelLabel", header: "Autorisée par", render: (r) => <span className="text-sm">{r.personnelLabel as string}</span> },
    {
      key: "statut",
      header: "Statut",
      render: (row) => {
        const r = row as unknown as DerogationPaiementRecord;
        const statut = statutDerogation(r);
        const jours = joursAvantExpiration(r.dateFin);
        return (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={statut} />
            {statut === "active" && jours <= 7 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" data-testid={`derogation-expire-bientot-${r.id}`}>
                <Clock size={10} /> {jours <= 0 ? "Expire aujourd'hui" : `Expire dans ${jours} j`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const r = row as unknown as DerogationPaiementRecord;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setLocation(`/admin/derogation-paiement/${r.id}`); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
            aria-label="Voir le détail"
            data-testid={`derogation-paiement-view-${r.id}`}
          >
            <Eye size={14} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Dérogation des paiements" }]}
        title="Dérogation des paiements"
        subtitle="Autorise exceptionnellement un étudiant en impayé à poursuivre une démarche (réinscription, retrait de documents), sans réduire sa dette"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="derogation-paiement-export-excel"
            >
              <Download size={14} /> Export excel
            </button>
            <button
              onClick={() => setLocation("/admin/derogation-paiement/new")}
              className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors"
              data-testid="derogation-paiement-nouveau"
            >
              <Plus size={14} /> Nouvelle dérogation
            </button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={derogations as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher..."
        emptyMessage="Aucune dérogation enregistrée"
        onRowClick={(row) => setLocation(`/admin/derogation-paiement/${(row as unknown as DerogationPaiementRecord).id}`)}
      />
    </div>
  );
}
