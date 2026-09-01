import { useMemo, useState } from "react";
import { Check, X, ShieldAlert, Eye } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { useMailsEnvoyes } from "@/hooks/useMailEnvoyeStore";
import { validerMail, rejeterMail, type MailEnvoyeRecord } from "@/data/mailEnvoyeStore";
import { estAutorise } from "@/data/communicationRolesStore";
import { useCommunicationRoles } from "@/hooks/useCommunicationRolesStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUT_CONFIG: Record<MailEnvoyeRecord["statut"], { label: string; cls: string }> = {
  traite: { label: "Traité", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  en_attente_validation: { label: "En attente", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  rejete: { label: "Rejeté", cls: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
};

export default function ValidationMailsPage() {
  const { currentUser } = useAuth();
  const mails = useMailsEnvoyes();
  useCommunicationRoles();
  const [preview, setPreview] = useState<MailEnvoyeRecord | null>(null);
  const [rejetTarget, setRejetTarget] = useState<MailEnvoyeRecord | null>(null);
  const [motif, setMotif] = useState("");

  const enAttente = useMemo(() => mails.filter((m) => m.statut === "en_attente_validation"), [mails]);
  const peutValider = currentUser ? estAutorise("validateur_message", currentUser.id) : false;

  const handleValider = (mail: MailEnvoyeRecord) => {
    if (!currentUser) return;
    try {
      validerMail(mail.id, currentUser.id, currentUser.name);
      toast.success(`Mail "${mail.objet}" validé et diffusé.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation impossible");
    }
  };

  const handleRejeter = () => {
    if (!currentUser || !rejetTarget) return;
    try {
      rejeterMail(rejetTarget.id, currentUser.id, currentUser.name, motif.trim());
      toast.success(`Mail "${rejetTarget.objet}" rejeté.`);
      setRejetTarget(null);
      setMotif("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejet impossible");
    }
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "auteurLabel", header: "Auteur", sortable: true },
    { key: "date", header: "Date", sortable: true, render: (row) => formatDateTime((row as unknown as MailEnvoyeRecord).date) },
    { key: "objet", header: "Objet", sortable: true },
    { key: "destinataires", header: "Destinataires", render: (row) => (row as unknown as MailEnvoyeRecord).destinataires.length },
    {
      key: "statut",
      header: "Statut",
      render: (row) => {
        const st = STATUT_CONFIG[(row as unknown as MailEnvoyeRecord).statut];
        return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", st.cls)}>{st.label}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => {
        const m = row as unknown as MailEnvoyeRecord;
        return (
          <div className="flex justify-end gap-1">
            <button onClick={(e) => { e.stopPropagation(); setPreview(m); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" title="Consulter" data-testid={`validation-consulter-${m.id}`}>
              <Eye size={14} />
            </button>
            {peutValider && (
              <>
                <button onClick={(e) => { e.stopPropagation(); handleValider(m); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-emerald-600" title="Valider" data-testid={`validation-valider-${m.id}`}>
                  <Check size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setRejetTarget(m); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-600" title="Rejeter" data-testid={`validation-rejeter-${m.id}`}>
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Communication" }, { label: "Validation mails" }]}
        title="Les validations mails"
        subtitle="Mails envoyés par des comptes non désignés comme validateur — en attente d'approbation"
      />

      {!peutValider && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-xl p-3 mb-4" data-testid="validation-non-autorise">
          <ShieldAlert size={14} /> Vous n'êtes pas désigné comme validateur de messages (Paramétrage communication) — lecture seule.
        </div>
      )}

      <DataTable
        columns={columns}
        data={enAttente as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Auteur, objet..."
        emptyMessage="Aucune validation en attente."
      />

      <FormModal open={!!preview} onClose={() => setPreview(null)} title="Consultation e-mail" subtitle={preview ? `Envoyé par ${preview.auteurLabel} le ${formatDateTime(preview.date)}` : undefined} size="lg">
        {preview && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Objet</p>
              <p className="text-sm font-semibold text-foreground">{preview.objet}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Destinataires ({preview.destinataires.length})</p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto">
                {preview.destinataires.map((d, i) => <span key={i} className="text-xs bg-muted px-2.5 py-1 rounded-full">{d.label}</span>)}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
              <div className="border border-border rounded-xl p-3 text-sm whitespace-pre-wrap bg-muted/20">{preview.message}</div>
            </div>
          </div>
        )}
      </FormModal>

      <FormModal open={!!rejetTarget} onClose={() => { setRejetTarget(null); setMotif(""); }} title="Rejeter ce mail" subtitle={rejetTarget?.objet}>
        <div className="space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">Motif du rejet</label>
          <textarea value={motif} onChange={(e) => setMotif(e.target.value)} className="w-full min-h-[100px] px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="validation-motif-rejet" />
          <p className="text-[11px] text-muted-foreground">L'auteur et les destinataires alert désignés (Paramétrage communication) seront notifiés.</p>
          <button onClick={handleRejeter} className="w-full px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors" data-testid="validation-confirmer-rejet">
            Confirmer le rejet
          </button>
        </div>
      </FormModal>
    </div>
  );
}
