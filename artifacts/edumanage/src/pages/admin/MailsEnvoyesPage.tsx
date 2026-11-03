import { useEffect, useMemo, useState } from "react";
import { Eye, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { useMailsEnvoyes } from "@/hooks/useMailEnvoyeStore";
import type { MailEnvoyeRecord } from "@/data/mailEnvoyeStore";
import { cn } from "@/lib/utils";
import { modeSupabase } from "@/lib/supabase";
import { lireLivraisons, resumeLivraison, type LivraisonCourriels } from "@/lib/courriels";

const STATUT_CONFIG: Record<MailEnvoyeRecord["statut"], { label: string; cls: string }> = {
  traite: { label: "Traité", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  en_attente_validation: { label: "En attente de validation", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  rejete: { label: "Rejeté", cls: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Ce que chaque mail a donné par e-mail (avec la base). */
function useLivraisons(mails: MailEnvoyeRecord[]): Record<string, LivraisonCourriels> {
  const ids = useMemo(() => mails.filter((m) => m.statut === "traite").map((m) => m.id).slice(0, 500), [mails]);
  const cle = ids.join("|");
  const [livraisons, setLivraisons] = useState<Record<string, LivraisonCourriels>>({});
  useEffect(() => {
    if (!modeSupabase || ids.length === 0) return;
    let actif = true;
    void lireLivraisons(ids).then((l) => { if (actif) setLivraisons(l); });
    return () => { actif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  return livraisons;
}

export default function MailsEnvoyesPage() {
  const mails = useMailsEnvoyes();
  const [preview, setPreview] = useState<MailEnvoyeRecord | null>(null);
  const livraisons = useLivraisons(mails);

  const columns: Column<Record<string, unknown>>[] = [
    { key: "auteurLabel", header: "Auteur", sortable: true },
    { key: "date", header: "Date", sortable: true, render: (row) => formatDateTime((row as unknown as MailEnvoyeRecord).date) },
    { key: "objet", header: "Objet", sortable: true },
    {
      key: "destinataires",
      header: "Destinataires",
      render: (row) => (row as unknown as MailEnvoyeRecord).destinataires.length,
    },
    {
      key: "statut",
      header: "Statut",
      render: (row) => {
        const m = row as unknown as MailEnvoyeRecord;
        const st = STATUT_CONFIG[m.statut];
        return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", st.cls)}>{st.label}</span>;
      },
    },
    ...(modeSupabase ? [{
      key: "courriels",
      header: "E-mails",
      render: (row: Record<string, unknown>) => {
        const m = row as unknown as MailEnvoyeRecord;
        const l = livraisons[m.id];
        return <span className="text-xs text-muted-foreground" title={l?.motif ?? undefined} data-testid={`mail-courriels-${m.id}`}>{resumeLivraison(l)}</span>;
      },
    }] : []),
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setPreview(row as unknown as MailEnvoyeRecord); }}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"
          title="Consulter"
          data-testid={`mail-consulter-${(row as unknown as MailEnvoyeRecord).id}`}
        >
          <Eye size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Communication" }, { label: "Mails envoyés" }]}
        title="Les mails envoyés"
        subtitle="Journal réel de toutes les diffusions — traitées, en attente de validation ou rejetées"
      />

      <DataTable
        columns={columns}
        data={mails as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Auteur, objet..."
        onRowClick={(row) => setPreview(row as unknown as MailEnvoyeRecord)}
        emptyMessage="Aucun mail envoyé pour l'instant."
      />

      <FormModal open={!!preview} onClose={() => setPreview(null)} title="Consultation e-mail" subtitle={preview ? `Envoyé par ${preview.auteurLabel} le ${formatDateTime(preview.date)}` : undefined} size="lg">
        {preview && (
          <div className="space-y-4">
            <span className={cn("inline-block text-xs font-medium px-2.5 py-1 rounded-full", STATUT_CONFIG[preview.statut].cls)}>
              {STATUT_CONFIG[preview.statut].label}
            </span>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Objet</p>
              <p className="text-sm font-semibold text-foreground">{preview.objet}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Destinataires ({preview.destinataires.length})</p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto">
                {preview.destinataires.map((d, i) => (
                  <span key={i} className="text-xs bg-muted px-2.5 py-1 rounded-full">{d.label}</span>
                ))}
                {preview.destinataires.length === 0 && <p className="text-xs text-muted-foreground">Aucun destinataire résolu.</p>}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
              <div className="border border-border rounded-xl p-3 text-sm whitespace-pre-wrap bg-muted/20">{preview.message}</div>
            </div>

            {preview.fichiers.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip size={12} /> {preview.fichiers.join(", ")}
              </div>
            )}

            {modeSupabase && preview.statut === "traite" && (
              <p className="text-xs text-muted-foreground" data-testid="mail-courriels-detail">
                E-mails : {resumeLivraison(livraisons[preview.id])}
                {livraisons[preview.id]?.motif && ` — ${livraisons[preview.id]?.motif}`}
              </p>
            )}

            {preview.statut === "rejete" && preview.motifRejet && (
              <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 rounded-xl p-3">
                Motif de rejet : {preview.motifRejet}
              </div>
            )}

            {preview.validateurLabel && (
              <p className="text-[11px] text-muted-foreground">
                {preview.statut === "rejete" ? "Rejeté" : "Traité"} par {preview.validateurLabel}
                {preview.dateTraitement && ` le ${formatDateTime(preview.dateTraitement)}`}
              </p>
            )}
          </div>
        )}
      </FormModal>
    </div>
  );
}
