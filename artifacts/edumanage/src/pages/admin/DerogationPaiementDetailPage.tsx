import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useDerogationsPaiement } from "@/hooks/useDerogationPaiementStore";
import { revoquerDerogation, statutDerogation, PORTEE_LABELS } from "@/data/derogationPaiementStore";
import { formatCFA, formatDate, formatShortDate, cn } from "@/lib/utils";

export default function DerogationPaiementDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const derogations = useDerogationsPaiement();
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [motifRevocation, setMotifRevocation] = useState("");

  const record = derogations.find((d) => d.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Dérogation des paiements", href: "/admin/derogation-paiement" }]}
          title="Dérogation introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cette dérogation n&apos;existe pas.
        </div>
      </div>
    );
  }

  const statut = statutDerogation(record);

  const handleRevoke = () => {
    if (!motifRevocation.trim()) {
      toast.error("Le motif de révocation est obligatoire");
      return;
    }
    revoquerDerogation(record.id, motifRevocation.trim());
    toast.success(`Dérogation ${record.reference} révoquée`);
    setConfirmRevoke(false);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Dérogation des paiements", href: "/admin/derogation-paiement" }, { label: record.reference }]}
        title={`Dérogation ${record.reference}`}
        subtitle={`Accordée le ${formatDate(record.date)} par ${record.personnelLabel}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={statut} />
            <button onClick={() => setLocation("/admin/derogation-paiement")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
              <ArrowLeft size={15} /> Retour
            </button>
          </div>
        }
      />

      <div className="max-w-3xl space-y-4">
        <div className="bg-card border border-border rounded-xl p-6 grid sm:grid-cols-2 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Étudiant</p>
            <p className="text-sm font-medium text-foreground">{record.etudiantLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Solde dû constaté à l&apos;octroi</p>
            <p className="text-sm font-medium text-foreground">{formatCFA(record.soldeDuConstate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Portée</p>
            <p className="text-sm font-medium text-foreground">{PORTEE_LABELS[record.portee]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Autorisée par</p>
            <p className="text-sm font-medium text-foreground">{record.personnelLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Validité</p>
            <p className="text-sm font-medium text-foreground">{formatShortDate(record.dateDebut)} → {formatShortDate(record.dateFin)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Statut</p>
            <StatusBadge status={statut} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs text-muted-foreground mb-1">Motif</p>
          <p className="text-sm text-foreground">{record.motif}</p>
        </div>

        {record.revoquee && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-6">
            <p className="text-xs text-red-700 dark:text-red-300 font-semibold mb-1">Révoquée le {record.revoqueeLe ? formatDate(record.revoqueeLe) : "—"}</p>
            <p className="text-sm text-red-800 dark:text-red-200">{record.motifRevocation}</p>
          </div>
        )}

        {!record.revoquee && (
          <button
            onClick={() => setConfirmRevoke(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            data-testid="derogation-revoquer"
          >
            <Ban size={15} /> Révoquer cette dérogation
          </button>
        )}
      </div>

      {confirmRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmRevoke(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Révoquer {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              L&apos;étudiant redeviendra soumis aux règles normales pour cette portée. Action irréversible.
            </p>
            <textarea
              value={motifRevocation}
              onChange={(e) => setMotifRevocation(e.target.value)}
              rows={2}
              placeholder="Motif de révocation (obligatoire)…"
              className={cn("w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y mb-4")}
              data-testid="derogation-motif-revocation"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmRevoke(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button type="button" onClick={handleRevoke} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700" data-testid="derogation-revoquer-confirmer">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
